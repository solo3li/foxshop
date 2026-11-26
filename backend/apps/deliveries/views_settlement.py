import logging
import secrets
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.accounts.models import User, PlatformSetting
from apps.restaurants.models import Restaurant
from apps.orders.models import Order
from apps.deliveries.models import DriverProfile, ShiftSettlement
from apps.deliveries.serializers import ShiftSettlementSerializer
from apps.payments.models import Wallet, Transaction
from apps.notifications.services import publish_centrifugo_event

logger = logging.getLogger(__name__)


class DriverPendingSettlementsView(APIView):
    """
    Returns pending shift settlements for the authenticated driver.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        settlements = ShiftSettlement.objects.filter(
            driver=request.user,
            status=ShiftSettlement.Status.PENDING
        ).select_related('restaurant').prefetch_related('orders').order_by('-created_at')

        serializer = ShiftSettlementSerializer(settlements, many=True)
        return Response({
            'count': settlements.count(),
            'settlements': serializer.data
        }, status=status.HTTP_200_OK)


class DriverVerifySettlementOTPView(APIView):
    """
    Verifies the 6-digit OTP code provided by the merchant to finalize shift cash settlement.
    Clears the driver's cash_in_hand for those orders, records settlement as completed,
    and automatically deducts platform commission from merchant's wallet balance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        otp_code = str(request.data.get('otp_code') or request.data.get('otp') or '').strip()
        settlement_id = request.data.get('settlement_id')
        restaurant_id = request.data.get('restaurant_id') or request.data.get('restaurant')

        if not otp_code:
            return Response({'error': 'يرجى إدخال رمز التحقق (OTP)'}, status=status.HTTP_400_BAD_REQUEST)

        qs = ShiftSettlement.objects.filter(
            driver=request.user,
            status=ShiftSettlement.Status.PENDING,
            otp_code=otp_code
        )
        if settlement_id:
            qs = qs.filter(id=settlement_id)
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)

        settlement = qs.first()
        if not settlement:
            return Response({
                'error': 'رمز التحقق (OTP) غير صحيح أو انتهت صلاحية التسوية'
            }, status=status.HTTP_400_BAD_REQUEST)

        if settlement.is_expired:
            return Response({
                'error': 'انتهت صلاحية رمز التحقق (OTP) للتسوية (صالح لمدة ساعتين فقط). يرجى مطالبة التاجر بإنشاء رمز جديد.'
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            settlement = ShiftSettlement.objects.select_for_update().filter(
                id=settlement.id,
                status=ShiftSettlement.Status.PENDING
            ).first()
            if not settlement:
                return Response({
                    'error': 'تمت معالجة هذه التسوية مسبقاً أو تم إلغاؤها'
                }, status=status.HTTP_400_BAD_REQUEST)

            settlement.status = ShiftSettlement.Status.COMPLETED
            settlement.settled_at = timezone.now()
            settlement.save(update_fields=['status', 'settled_at'])

            # 1. Clear driver cash_in_hand
            profile, _ = DriverProfile.objects.get_or_create(user=request.user)
            # Reduce driver cash_in_hand by total goods amount (or the collected COD)
            profile.cash_in_hand = max(Decimal('0.00'), profile.cash_in_hand - settlement.total_goods_amount)
            profile.save(update_fields=['cash_in_hand'])

            # 2. Mark orders as settled with merchant
            settlement.orders.update(is_settled_with_merchant=True)

            # 3. Deduct platform commission from merchant's wallet
            merchant_user = settlement.restaurant.owner
            currency_code = settlement.restaurant.currency_id or 'EGP'
            wallet, _ = Wallet.objects.get_or_create(
                user=merchant_user,
                defaults={'currency': currency_code, 'balance': Decimal('0.00')}
            )
            wallet.balance = Decimal(str(wallet.balance)) - settlement.platform_commission_amount
            wallet.save(update_fields=['balance'])

            Transaction.objects.create(
                wallet=wallet,
                amount=-settlement.platform_commission_amount,
                transaction_type=Transaction.Types.PAYOUT,
                reference_id=f"SETTLE-{str(settlement.id)[:8]}",
                description=f"عمولة المنصة عن تسوية كاش شفت مع الكابتن {request.user.username} - متجر {settlement.restaurant.name}"
            )

        # Real-time WebSocket notifications to both parties
        publish_centrifugo_event(
            channel=f"orders:merchant_{settlement.restaurant.owner_id}",
            event_type="SETTLEMENT_COMPLETED",
            data={
                'settlement_id': str(settlement.id),
                'driver_name': request.user.get_full_name() or request.user.username,
                'total_goods_amount': float(settlement.total_goods_amount),
                'platform_commission': float(settlement.platform_commission_amount),
                'settled_at': settlement.settled_at.isoformat()
            }
        )

        publish_centrifugo_event(
            channel=f"driver_{request.user.id}",
            event_type="SETTLEMENT_COMPLETED",
            data={
                'settlement_id': str(settlement.id),
                'restaurant_name': settlement.restaurant.name,
                'total_goods_amount': float(settlement.total_goods_amount),
                'remaining_cash_in_hand': float(profile.cash_in_hand),
                'settled_at': settlement.settled_at.isoformat()
            }
        )

        return Response({
            'message': 'تم التحقق بنجاح وإتمام تسوية الشفت النقدية',
            'settlement': ShiftSettlementSerializer(settlement).data,
            'remaining_cash_in_hand': float(profile.cash_in_hand)
        }, status=status.HTTP_200_OK)


class MerchantSettlementsListView(APIView):
    """
    Returns list of shift settlements and active unsettled drivers for merchant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        restaurant = Restaurant.objects.filter(owner=request.user).first()
        if not restaurant:
            return Response({'error': 'لا يوجد متجر مسجل لهذا الحساب'}, status=status.HTTP_404_NOT_FOUND)

        # Past / current settlements
        settlements = ShiftSettlement.objects.filter(
            restaurant=restaurant
        ).select_related('driver').prefetch_related('orders').order_by('-created_at')

        # Find delivered COD orders that have not been settled yet
        unsettled_orders = Order.objects.filter(
            restaurant=restaurant,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.COD,
            is_settled_with_merchant=False
        ).select_related('delivery_trip__driver')

        # Group by driver
        drivers_map = {}
        for order in unsettled_orders:
            driver = getattr(order.delivery_trip, 'driver', None) if hasattr(order, 'delivery_trip') else None
            if not driver:
                continue
            driver_id = str(driver.id)
            if driver_id not in drivers_map:
                drivers_map[driver_id] = {
                    'driver_id': driver_id,
                    'driver_name': driver.get_full_name() or driver.username,
                    'phone_number': getattr(driver, 'phone_number', '') or '',
                    'orders_count': 0,
                    'total_goods_amount': Decimal('0.00'),
                    'order_ids': []
                }
            drivers_map[driver_id]['orders_count'] += 1
            drivers_map[driver_id]['total_goods_amount'] += order.subtotal
            drivers_map[driver_id]['order_ids'].append(str(order.id))

        # Format unsettled drivers list
        unsettled_drivers = [
            {
                'driver_id': v['driver_id'],
                'driver_name': v['driver_name'],
                'phone_number': v['phone_number'],
                'orders_count': v['orders_count'],
                'total_goods_amount': float(v['total_goods_amount']),
                'order_ids': v['order_ids']
            }
            for v in drivers_map.values()
        ]

        serializer = ShiftSettlementSerializer(settlements, many=True)
        return Response({
            'settlements': serializer.data,
            'unsettled_drivers': unsettled_drivers
        }, status=status.HTTP_200_OK)


class MerchantPendingSettlementsView(APIView):
    """
    Returns active PENDING settlements showing the 6-digit OTP code to hand to the driver.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        restaurant = Restaurant.objects.filter(owner=request.user).first()
        if not restaurant:
            return Response({'error': 'لا يوجد متجر مسجل لهذا الحساب'}, status=status.HTTP_404_NOT_FOUND)

        pending = ShiftSettlement.objects.filter(
            restaurant=restaurant,
            status=ShiftSettlement.Status.PENDING
        ).select_related('driver').prefetch_related('orders').order_by('-created_at')

        serializer = ShiftSettlementSerializer(pending, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MerchantCreateSettlementOTPView(APIView):
    """
    Initiates a shift settlement with a driver, calculating 100% merchandise value and generating OTP.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        driver_id = request.data.get('driver_id')
        if not driver_id:
            return Response({'error': 'يرجى تحديد الكابتن المراد عمل التسوية معه'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            driver = User.objects.get(id=driver_id, role=User.Roles.DRIVER)
        except User.DoesNotExist:
            return Response({'error': 'الكابتن المحدد غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        restaurant_id = request.data.get('restaurant_id') or request.data.get('restaurant')
        if restaurant_id:
            restaurant = Restaurant.objects.filter(owner=request.user, id=restaurant_id).first()
        else:
            restaurant = Restaurant.objects.filter(
                owner=request.user,
                orders__delivery_trip__driver=driver,
                orders__status=Order.Status.DELIVERED,
                orders__payment_method=Order.PaymentMethod.COD,
                orders__is_settled_with_merchant=False
            ).first() or Restaurant.objects.filter(owner=request.user).first()

        if not restaurant:
            return Response({'error': 'لا يوجد متجر مسجل لهذا الحساب'}, status=status.HTTP_404_NOT_FOUND)

        # Find all unsettled delivered COD orders for this restaurant and driver
        unsettled_orders = Order.objects.filter(
            restaurant=restaurant,
            delivery_trip__driver=driver,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.COD,
            is_settled_with_merchant=False
        )

        orders_count = unsettled_orders.count()
        if orders_count == 0:
            return Response({
                'error': 'لا توجد طلبات كاش مستحقة التسوية مع هذا الكابتن حالياً'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 100% of merchandise value (subtotal without deduction of platform commission at driver level)
        total_goods_amount = unsettled_orders.aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')

        # Commission rate from platform settings
        platform_setting = PlatformSetting.get_settings()
        comm_rate = Decimal(str(platform_setting.platform_commission_percent))
        commission_amount = round(total_goods_amount * (comm_rate / Decimal('100.0')), 2)

        # Create or update existing pending settlement for this driver
        settlement = ShiftSettlement.objects.filter(
            restaurant=restaurant,
            driver=driver,
            status=ShiftSettlement.Status.PENDING
        ).first()

        if not settlement:
            settlement = ShiftSettlement.objects.create(
                restaurant=restaurant,
                driver=driver,
                orders_count=orders_count,
                total_goods_amount=total_goods_amount,
                platform_commission_amount=commission_amount,
                status=ShiftSettlement.Status.PENDING
            )
        else:
            settlement.orders_count = orders_count
            settlement.total_goods_amount = total_goods_amount
            settlement.platform_commission_amount = commission_amount
            settlement.otp_code = f"{secrets.randbelow(900000) + 100000}"
            settlement.created_at = timezone.now()
            settlement.save(update_fields=['orders_count', 'total_goods_amount', 'platform_commission_amount', 'otp_code', 'created_at'])

        settlement.orders.set(unsettled_orders)

        # Real-time event to driver
        publish_centrifugo_event(
            channel=f"driver_{driver.id}",
            event_type="SETTLEMENT_INITIATED",
            data={
                'settlement_id': str(settlement.id),
                'restaurant_name': restaurant.name,
                'total_goods_amount': float(settlement.total_goods_amount),
                'orders_count': settlement.orders_count
            }
        )

        return Response({
            'message': 'تم إنشاء كود تسوية الشفت بنجاح. يرجى إعطاء الكود للكابتن عند استلام الكاش.',
            'settlement': ShiftSettlementSerializer(settlement).data,
            'otp_code': settlement.otp_code
        }, status=status.HTTP_201_CREATED)
