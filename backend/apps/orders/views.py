from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from datetime import datetime
from .models import Order
from .serializers import OrderDetailSerializer, OrderCreateSerializer
from apps.notifications.services import publish_centrifugo_event

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


class CustomerCancelOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            order = Order.objects.get(id=id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'الطلب غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.Status.PENDING:
            return Response({'error': 'لا يمكن إلغاء الطلب بعد قبوله والبدء في تجهيزه من قِبل المطعم'}, status=status.HTTP_400_BAD_REQUEST)

        order.transition_to(Order.Status.CANCELLED, note="تم الإلغاء بواسطة العميل")
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
        try:
            order = Order.objects.get(id=id, restaurant__owner=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'الطلب غير موجود أو لا تملك صلاحية إدارته'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        prep_time = request.data.get('prep_time_minutes')
        reason = request.data.get('reason', '')

        valid_transitions = [
            Order.Status.CONFIRMED,
            Order.Status.PREPARING,
            Order.Status.READY_FOR_PICKUP,
            Order.Status.CANCELLED
        ]

        if new_status not in valid_transitions:
            return Response({'error': f'الحالة غير صالحة. الحالات المسموحة: {valid_transitions}'}, status=status.HTTP_400_BAD_REQUEST)

        if prep_time:
            order.prep_time_minutes = int(prep_time)
            order.save(update_fields=['prep_time_minutes'])

        if new_status == Order.Status.CANCELLED and reason:
            order.cancellation_reason = reason
            order.save(update_fields=['cancellation_reason'])

        order.transition_to(new_status, note=reason or f"تحديث الحالة بواسطة المطعم إلى {new_status}")

        # Trigger auto-dispatch when order starts preparing
        if new_status in [Order.Status.CONFIRMED, Order.Status.PREPARING]:
            try:
                from apps.deliveries.tasks import task_schedule_order_dispatch
                task_schedule_order_dispatch.delay(str(order.id))
            except Exception:
                pass

        # Real-time event to customer and order tracking
        publish_centrifugo_event(
            channel=f"orders:order_{order.id}",
            event_type="STATUS_CHANGED",
            data={'order_id': str(order.id), 'status': order.status, 'status_display': order.get_status_display()}
        )

        return Response({'message': 'تم تحديث حالة الطلب', 'order': OrderDetailSerializer(order).data})
