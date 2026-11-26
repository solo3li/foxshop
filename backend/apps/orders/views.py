from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Q
from datetime import datetime
from decimal import Decimal, InvalidOperation
from .models import Order, OrderItem
from .serializers import OrderDetailSerializer, OrderCreateSerializer
from apps.notifications.services import publish_centrifugo_event
from apps.payments.models import Wallet, Transaction

class CustomerOrderCreateView(generics.CreateAPIView):
    serializer_class = OrderCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # Real-time event to merchant channel
        publish_centrifugo_event(
            channel=f"orders:merchant_{order.restaurant.owner_id}",
            event_type="NEW_ORDER",
            data={'order_id': str(order.id), 'order_number': order.order_number, 'total': str(order.total_amount)}
        )

        return Response(OrderDetailSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrderListView(generics.ListAPIView):
    serializer_class = OrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user)


class CustomerOrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user)


def _refund_or_release_order(order, note_prefix="استرداد قيمة الطلب الملغي"):
    """Refund customer wallet or release CARD pre-auth hold when an order is cancelled/rejected."""
    if order.payment_method == Order.PaymentMethod.WALLET and order.payment_status == Order.PaymentStatus.PAID:
        refund_amount = Decimal(str(order.total_amount))
        if refund_amount > Decimal('0.00'):
            wallet, _ = Wallet.objects.select_for_update().get_or_create(
                user=order.customer,
                defaults={'currency': order.currency or 'EGP', 'balance': Decimal('0.00')}
            )
            wallet.balance = Decimal(str(wallet.balance)) + refund_amount
            wallet.save(update_fields=['balance', 'updated_at'])
            Transaction.objects.create(
                wallet=wallet,
                amount=refund_amount,
                transaction_type=Transaction.Types.REFUND,
                reference_id=f"REF-{order.order_number}",
                description=f"{note_prefix} #{order.order_number}"
            )
        order.payment_status = Order.PaymentStatus.REFUNDED
        order.save(update_fields=['payment_status', 'updated_at'])
    elif order.payment_method == Order.PaymentMethod.CARD:
        if Decimal(str(order.preauth_hold_amount)) > Decimal('0.00') or order.payment_status == Order.PaymentStatus.PAID:
            order.preauth_hold_amount = Decimal('0.00')
            order.payment_status = Order.PaymentStatus.REFUNDED
            order.save(update_fields=['preauth_hold_amount', 'payment_status', 'updated_at'])

    # F16: Restore coupon usage upon cancellation / rejection
    try:
        from apps.promotions.models import CouponUsage
        usages = CouponUsage.objects.filter(order=order)
        if usages.exists():
            usages.delete()
        else:
            coupon = getattr(order, 'coupon', None)
            if coupon and order.customer:
                usage = CouponUsage.objects.filter(coupon=coupon, user=order.customer).order_by('-used_at').first()
                if usage:
                    usage.delete()
    except Exception:
        pass


class CustomerCancelOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().get(id=id, customer=request.user)
            except Order.DoesNotExist:
                return Response({'error': 'الطلب غير موجود'}, status=status.HTTP_404_NOT_FOUND)

            if order.status != Order.Status.PENDING:
                return Response({'error': 'لا يمكن إلغاء الطلب بعد قبوله والبدء في تجهيزه من قِبل المطعم'}, status=status.HTTP_400_BAD_REQUEST)

            order.transition_to(Order.Status.CANCELLED, note="تم الإلغاء بواسطة العميل")
            _refund_or_release_order(order, note_prefix="استرداد قيمة الطلب الملغي")

        publish_centrifugo_event(
            channel=f"orders:order_{order.id}",
            event_type="ORDER_CANCELLED",
            data={'order_id': str(order.id), 'status': Order.Status.CANCELLED}
        )
        return Response({'message': 'تم إلغاء الطلب بنجاح', 'order': OrderDetailSerializer(order).data})


class MerchantOrderListView(generics.ListAPIView):
    serializer_class = OrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.filter(restaurant__owner=user).select_related(
            'customer', 'restaurant', 'delivery_trip__driver'
        ).prefetch_related('items__modifiers', 'status_history').order_by('-created_at')

        # Status filter
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.upper() != 'ALL':
            qs = qs.filter(status=status_filter.upper())

        # Search filter (order number, customer phone, customer name)
        search_query = self.request.query_params.get('search')
        if search_query:
            search_query = search_query.strip()
            qs = qs.filter(
                Q(order_number__icontains=search_query) |
                Q(customer__phone_number__icontains=search_query) |
                Q(customer__first_name__icontains=search_query) |
                Q(customer__last_name__icontains=search_query) |
                Q(customer__username__icontains=search_query)
            )

        # Payment method filter
        payment_method = self.request.query_params.get('payment_method')
        if payment_method and payment_method.upper() != 'ALL':
            qs = qs.filter(payment_method=payment_method.upper())

        # Date range filters
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            try:
                dt_from = datetime.fromisoformat(date_from)
                qs = qs.filter(created_at__gte=dt_from)
            except (ValueError, TypeError):
                pass
        if date_to:
            try:
                dt_to = datetime.fromisoformat(date_to)
                qs = qs.filter(created_at__lte=dt_to)
            except (ValueError, TypeError):
                pass

        return qs


class MerchantOrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Order.objects.filter(
            restaurant__owner=self.request.user
        ).select_related(
            'customer', 'restaurant', 'delivery_trip__driver'
        ).prefetch_related('items__modifiers', 'status_history')


class MerchantUpdateOrderStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, id):
        return self.post(request, id)

    def post(self, request, id):
        new_status = request.data.get('status')
        prep_time = request.data.get('prep_time_minutes') or request.data.get('prep_time') or request.data.get('estimated_prep_time')
        reason = request.data.get('reason', '')

        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().select_related(
                    'restaurant', 'restaurant__owner', 'customer'
                ).get(id=id, restaurant__owner=request.user)
            except Order.DoesNotExist:
                return Response({'error': 'الطلب غير موجود أو لا تملك صلاحية إدارته'}, status=status.HTTP_404_NOT_FOUND)

            valid_transitions = [
                Order.Status.CONFIRMED,
                Order.Status.PREPARING,
                Order.Status.READY_FOR_PICKUP,
                Order.Status.CANCELLED
            ]

            from apps.restaurants.models import Restaurant
            if order.restaurant.delivery_mode == Restaurant.DeliveryMode.STORE_OWN_FLEET:
                valid_transitions.extend([Order.Status.ON_THE_WAY, Order.Status.DELIVERED])

            if new_status not in valid_transitions:
                return Response({'error': f'الحالة غير صالحة. الحالات المسموحة: {valid_transitions}'}, status=status.HTTP_400_BAD_REQUEST)

            old_status = order.status
            if old_status == Order.Status.CANCELLED and new_status == Order.Status.CANCELLED:
                return Response({'error': 'الطلب ملغي بالفعل'}, status=status.HTTP_400_BAD_REQUEST)

            if old_status in [Order.Status.DELIVERED, Order.Status.CANCELLED] and new_status != old_status:
                return Response(
                    {'error': f'لا يمكن تغيير حالة الطلب بعد الوصول إلى الحالة النهائية {old_status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if prep_time:
                order.prep_time_minutes = int(prep_time)
                order.save(update_fields=['prep_time_minutes'])

            if new_status == Order.Status.CANCELLED and reason:
                order.cancellation_reason = reason
                order.save(update_fields=['cancellation_reason'])

            if old_status != new_status:
                order.transition_to(new_status, note=reason or f"تحديث الحالة بواسطة المطعم إلى {new_status}")

            if new_status == Order.Status.CANCELLED:
                _refund_or_release_order(order, note_prefix="استرداد قيمة الطلب المرفوض/الملغي من المتجر")

            # F9: Idempotent commission deduction on STORE_OWN_FLEET COD orders
            if new_status == Order.Status.DELIVERED and order.restaurant.delivery_mode == Restaurant.DeliveryMode.STORE_OWN_FLEET:
                update_fields = []
                if not order.is_settled_with_merchant:
                    order.is_settled_with_merchant = True
                    update_fields.append('is_settled_with_merchant')

                if order.payment_method == Order.PaymentMethod.COD and not order.is_commission_deducted:
                    from apps.accounts.models import PlatformSetting
                    platform_setting = PlatformSetting.get_settings()
                    comm_rate = Decimal(str(platform_setting.platform_commission_percent))
                    comm_amount = round(order.subtotal * (comm_rate / Decimal('100.0')), 2)

                    merchant_user = order.restaurant.owner
                    currency_code = order.restaurant.currency_id or 'EGP'
                    wallet, _ = Wallet.objects.select_for_update().get_or_create(
                        user=merchant_user,
                        defaults={'currency': currency_code, 'balance': Decimal('0.00')}
                    )
                    wallet.balance = Decimal(str(wallet.balance)) - comm_amount
                    wallet.save(update_fields=['balance', 'updated_at'])

                    Transaction.objects.create(
                        wallet=wallet,
                        amount=-comm_amount,
                        transaction_type=Transaction.Types.PAYOUT,
                        reference_id=f"COMM-{str(order.id)[:8]}",
                        description=f"عمولة المنصة عن طلب أسطول المتجر الخاص #{order.order_number}"
                    )
                    order.is_commission_deducted = True
                    update_fields.append('is_commission_deducted')

                if update_fields:
                    order.save(update_fields=update_fields)

        # Trigger auto-dispatch when order starts preparing (ONLY if platform managed)
        if new_status in [Order.Status.CONFIRMED, Order.Status.PREPARING]:
            if order.restaurant.delivery_mode == Restaurant.DeliveryMode.PLATFORM_MANAGED:
                try:
                    import inngest
                    from core.inngest_client import inngest_client
                    inngest_client.send_sync(
                        inngest.Event(
                            name="order/prep.scheduled",
                            data={"order_id": str(order.id), "prep_minutes": order.prep_time_minutes or 25}
                        )
                    )
                except Exception:
                    pass

        # Real-time event to customer and order tracking
        publish_centrifugo_event(
            channel=f"orders:order_{order.id}",
            event_type="STATUS_CHANGED",
            data={'order_id': str(order.id), 'status': order.status, 'status_display': order.get_status_display()}
        )

        return Response({'message': 'تم تحديث حالة الطلب', 'order': OrderDetailSerializer(order).data})


class MerchantConfirmWeightsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        items_data = request.data.get('items', [])
        if not items_data:
            return Response({'error': 'يرجى تزويد قائمة الأوزان الفعلية للأصناف'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.menus.models import MenuItem

        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().get(id=id, restaurant__owner=request.user)
            except Order.DoesNotExist:
                return Response({'error': 'الطلب غير موجود أو لا تملك صلاحية إدارته'}, status=status.HTTP_404_NOT_FOUND)

            if order.status in [Order.Status.DELIVERED, Order.Status.CANCELLED]:
                return Response({'error': 'لا يمكن تعديل أوزان طلب مكتمل أو ملغي'}, status=status.HTTP_400_BAD_REQUEST)

            if order.is_weight_confirmed:
                return Response({'error': 'تم تأكيد الأوزان لهذا الطلب مسبقاً'}, status=status.HTTP_400_BAD_REQUEST)

            initial_authorized = Decimal(str(order.total_amount))
            initial_hold = Decimal(str(order.preauth_hold_amount))

            updated_items_count = 0
            for item_entry in items_data:
                item_id = item_entry.get('item_id') or item_entry.get('id')
                actual_w = item_entry.get('actual_weight')
                if not item_id or actual_w is None:
                    continue

                try:
                    actual_weight = Decimal(str(actual_w))
                except (InvalidOperation, ValueError, TypeError):
                    transaction.set_rollback(True)
                    return Response({'error': f'قيمة الوزن الفعلي غير صالحة للصنف: {actual_w}'}, status=status.HTTP_400_BAD_REQUEST)

                if not actual_weight.is_finite():
                    transaction.set_rollback(True)
                    return Response({'error': f'قيمة الوزن الفعلي غير صالحة للصنف: {actual_w}'}, status=status.HTTP_400_BAD_REQUEST)

                if actual_weight < Decimal('0.000') or (
                    actual_weight == Decimal('0.000')
                    and order.payment_method not in [Order.PaymentMethod.CARD, Order.PaymentMethod.WALLET]
                ):
                    transaction.set_rollback(True)
                    return Response({'error': 'يجب أن يكون الوزن الفعلي أكبر من صفر'}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    order_item = order.items.get(id=item_id)
                except OrderItem.DoesNotExist:
                    continue

                order_item.actual_weight = actual_weight
                order_item.is_weighted = True
                updated_items_count += 1

                if actual_weight == Decimal('0.000'):
                    order_item.total_price = Decimal('0.00')
                else:
                    # Recalculate price
                    unit_price = order_item.unit_price
                    pricing_unit = getattr(order_item.menu_item, 'pricing_unit', MenuItem.PricingUnit.PIECE) if order_item.menu_item else MenuItem.PricingUnit.PIECE

                    if pricing_unit == MenuItem.PricingUnit.GRAM:
                        base_line_price = round((unit_price / Decimal('1000')) * actual_weight, 2)
                    else:
                        base_line_price = round(unit_price * actual_weight, 2)

                    modifiers_delta = sum((Decimal(str(m.price_delta)) for m in order_item.modifiers.all()), Decimal('0.00'))
                    order_item.total_price = base_line_price + modifiers_delta

                order_item.save(update_fields=['actual_weight', 'is_weighted', 'total_price'])

            if updated_items_count == 0:
                transaction.set_rollback(True)
                return Response({'error': 'لم يتم تحديث أي صنف، يرجى التأكد من معرفات الأصناف والأوزان'}, status=status.HTTP_400_BAD_REQUEST)

            # Recalculate order subtotal and final total
            new_subtotal = sum((i.total_price for i in order.items.all()), Decimal('0.00'))
            exact_total = max(Decimal('0.00'), new_subtotal + order.delivery_fee - order.discount_amount)

            # Enforce pre-auth hold ceiling on CARD orders when hold was placed (reject extreme overruns)
            if order.payment_method == Order.PaymentMethod.CARD and initial_hold > Decimal('0.00') and exact_total > initial_authorized * Decimal('1.3'):
                transaction.set_rollback(True)
                return Response(
                    {'error': 'إجمالي الفاتورة بعد الوزن الفعلي يتجاوز سقف الحجز المسبق المعتمد'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            captured_amount = exact_total
            released_hold = max(Decimal('0.00'), initial_authorized - exact_total)

            if order.payment_method == Order.PaymentMethod.CARD:
                order.payment_status = Order.PaymentStatus.PAID
            elif order.payment_method == Order.PaymentMethod.WALLET and order.payment_status == Order.PaymentStatus.PAID:
                if released_hold > Decimal('0.00'):
                    wallet, _ = Wallet.objects.select_for_update().get_or_create(
                        user=order.customer,
                        defaults={'currency': order.currency or 'EGP', 'balance': Decimal('0.00')}
                    )
                    wallet.balance = Decimal(str(wallet.balance)) + released_hold
                    wallet.save(update_fields=['balance', 'updated_at'])
                    Transaction.objects.create(
                        wallet=wallet,
                        amount=released_hold,
                        transaction_type=Transaction.Types.REFUND,
                        reference_id=f"WGT-REF-{order.order_number}",
                        description=f"استرداد فرق الوزن الفعلي للطلب #{order.order_number}"
                    )
                elif exact_total > initial_authorized:
                    extra_delta = exact_total - initial_authorized
                    wallet = Wallet.objects.select_for_update().filter(user=order.customer).first()
                    if wallet is None or Decimal(str(wallet.balance)) < extra_delta:
                        transaction.set_rollback(True)
                        return Response(
                            {'error': 'رصيد المحفظة غير كافٍ لتغطية الزيادة في الوزن'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    wallet.balance = Decimal(str(wallet.balance)) - extra_delta
                    wallet.save(update_fields=['balance', 'updated_at'])
                    Transaction.objects.create(
                        wallet=wallet,
                        amount=-extra_delta,
                        transaction_type=Transaction.Types.ORDER_PAYMENT,
                        reference_id=f"WGT-ADD-{order.order_number}",
                        description=f"خصم فرق زيادة الوزن الفعلي للطلب #{order.order_number}"
                    )

            order.subtotal = new_subtotal
            order.total_amount = exact_total
            order.preauth_hold_amount = Decimal('0.00')
            order.is_weight_confirmed = True

            order.save(update_fields=[
                'subtotal', 'total_amount', 'preauth_hold_amount',
                'is_weight_confirmed', 'payment_status', 'updated_at'
            ])

        # Real-time event to customer channel
        publish_centrifugo_event(
            channel=f"orders:order_{order.id}",
            event_type="order.weight_confirmed",
            data={
                'order_id': str(order.id),
                'order_number': order.order_number,
                'subtotal': float(order.subtotal),
                'total_amount': float(order.total_amount),
                'captured_amount': float(captured_amount),
                'released_hold': float(released_hold),
                'preauth_hold_amount': 0.0,
                'is_weight_confirmed': True,
                'items': [
                    {
                        'id': str(i.id),
                        'item_name': i.item_name,
                        'actual_weight': float(i.actual_weight) if i.actual_weight is not None else None,
                        'total_price': float(i.total_price)
                    }
                    for i in order.items.all()
                ]
            }
        )

        return Response({
            'message': 'تم تأكيد الوزن الفعلي وإعادة احتساب إجمالي الفاتورة بنجاح',
            'captured_amount': float(captured_amount),
            'released_hold': float(released_hold),
            'order': OrderDetailSerializer(order).data
        }, status=status.HTTP_200_OK)

