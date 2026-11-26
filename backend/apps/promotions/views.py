from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView
from django.utils import timezone
from django.db import models
from decimal import Decimal
from .models import Coupon, CouponUsage
from .serializers import (
    ValidateCouponInputSerializer,
    CouponDetailSerializer,
    MerchantCouponSerializer
)
from apps.orders.models import Order
from apps.restaurants.models import Restaurant


class CustomerValidateCouponView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ValidateCouponInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['code'].strip().upper()
        subtotal = serializer.validated_data['subtotal']
        delivery_fee = serializer.validated_data.get('delivery_fee', Decimal('0.00'))
        restaurant_id = serializer.validated_data.get('restaurant_id')

        now = timezone.now()
        try:
            coupon = Coupon.objects.select_related('restaurant').get(
                code=code,
                is_active=True,
                valid_from__lte=now,
                valid_to__gte=now
            )
        except Coupon.DoesNotExist:
            return Response({'error': 'كوبون الخصم غير صالح أو منتهي الصلاحية'}, status=status.HTTP_400_BAD_REQUEST)

        # Store-specific coupon validation
        if coupon.restaurant:
            if not restaurant_id or str(coupon.restaurant.id) != str(restaurant_id):
                return Response({
                    'error': f'هذا الكوبون خاص بـ "{coupon.restaurant.name}" فقط وغير متاح لهذا الطلب'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Check usage per user
        usage_count = CouponUsage.objects.filter(coupon=coupon, user=request.user).count()
        if usage_count >= coupon.max_usage_per_user:
            return Response({'error': 'لقد استنفدت الحد الأقصى المسموح لاستخدام هذا الكوبون'}, status=status.HTTP_400_BAD_REQUEST)

        # Check first order only
        if coupon.first_order_only:
            has_orders = Order.objects.filter(customer=request.user, status=Order.Status.DELIVERED).exists()
            if has_orders:
                return Response({'error': 'هذا الكوبون مخصص للعملاء الجدد وللطلب الأول فقط'}, status=status.HTTP_400_BAD_REQUEST)

        # Check minimum order requirement
        if subtotal < coupon.min_order_amount:
            return Response({
                'error': f'الحد الأدنى لقيمة الطلب لتطبيق هذا الكوبون هو {coupon.min_order_amount}'
            }, status=status.HTTP_400_BAD_REQUEST)

        discount_amount = coupon.calculate_discount(subtotal, delivery_fee)
        return Response({
            'valid': True,
            'code': coupon.code,
            'discount_type': coupon.discount_type,
            'discount_amount': discount_amount,
            'final_subtotal': max(Decimal('0.00'), subtotal - discount_amount),
            'coupon': CouponDetailSerializer(coupon).data
        }, status=status.HTTP_200_OK)


class CustomerListCouponsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        now = timezone.now()
        restaurant_id = request.query_params.get('restaurant_id')

        qs = Coupon.objects.filter(is_active=True, valid_from__lte=now, valid_to__gte=now)
        if restaurant_id:
            qs = qs.filter(models.Q(restaurant__isnull=True) | models.Q(restaurant_id=restaurant_id))
        else:
            qs = qs.filter(restaurant__isnull=True)

        coupons = qs.order_by('-discount_value')
        serializer = CouponDetailSerializer(coupons, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# --- Merchant Coupons APIs ---

class MerchantCouponListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_merchant_restaurant(self, request):
        restaurant = request.user.owned_restaurants.first()
        if not restaurant and (request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN'):
            restaurant = Restaurant.objects.first()
        return restaurant

    def get(self, request):
        restaurant = self._get_merchant_restaurant(request)
        if not restaurant:
            return Response({'error': 'المستخدم الحالي ليس لديه متجر مسجل'}, status=status.HTTP_403_FORBIDDEN)

        coupons = Coupon.objects.filter(restaurant=restaurant).order_by('-valid_from')
        serializer = MerchantCouponSerializer(coupons, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        restaurant = self._get_merchant_restaurant(request)
        if not restaurant:
            return Response({'error': 'المستخدم الحالي ليس لديه متجر مسجل'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MerchantCouponSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coupon = serializer.save(
            restaurant=restaurant,
            funded_by=Coupon.FundedBy.MERCHANT
        )
        return Response(MerchantCouponSerializer(coupon).data, status=status.HTTP_201_CREATED)


class MerchantCouponToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            coupon = Coupon.objects.get(id=pk, restaurant__owner=request.user)
        except Coupon.DoesNotExist:
            return Response({'error': 'الكوبون غير موجود أو ليس لديك صلاحية تعديله'}, status=status.HTTP_404_NOT_FOUND)

        coupon.is_active = not coupon.is_active
        coupon.save(update_fields=['is_active'])

        return Response({
            'id': coupon.id,
            'code': coupon.code,
            'is_active': coupon.is_active,
            'message': f"تم {'تفعيل' if coupon.is_active else 'تعطيل'} الكوبون {coupon.code} بنجاح"
        }, status=status.HTTP_200_OK)
