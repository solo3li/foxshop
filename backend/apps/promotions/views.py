from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import Coupon, CouponUsage
from .serializers import ValidateCouponInputSerializer, CouponDetailSerializer
from apps.orders.models import Order

class CustomerValidateCouponView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ValidateCouponInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['code'].strip().upper()
        subtotal = serializer.validated_data['subtotal']

        now = timezone.now()
        try:
            coupon = Coupon.objects.get(code=code, is_active=True, valid_from__lte=now, valid_to__gte=now)
        except Coupon.DoesNotExist:
            return Response({'error': 'كوبون الخصم غير صالح أو منتهي الصلاحية'}, status=status.HTTP_400_BAD_REQUEST)

        # Check usage per user
        usage_count = CouponUsage.objects.filter(coupon=coupon, user=request.user).count()
        if usage_count >= coupon.max_usage_per_user:
            return Response({'error': 'لقد استنفدت الحد الأقصى لاستخدام هذا الكوبون'}, status=status.HTTP_400_BAD_REQUEST)

        # Check first order only
        if coupon.first_order_only:
            has_orders = Order.objects.filter(customer=request.user, status=Order.Status.DELIVERED).exists()
            if has_orders:
                return Response({'error': 'هذا الكوبون مخصص للعملاء الجدد وللطلب الأول فقط'}, status=status.HTTP_400_BAD_REQUEST)

        if subtotal < coupon.min_order_amount:
            return Response({'error': f'الحد الأدنى لقيمة الطلب لتطبيق هذا الكوبون هو {coupon.min_order_amount}'}, status=status.HTTP_400_BAD_REQUEST)

        discount_amount = coupon.calculate_discount(subtotal)
        return Response({
            'valid': True,
            'code': coupon.code,
            'discount_amount': discount_amount,
            'final_subtotal': subtotal - discount_amount,
            'coupon': CouponDetailSerializer(coupon).data
        }, status=status.HTTP_200_OK)
