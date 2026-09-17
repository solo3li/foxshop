from rest_framework import serializers
from .models import Coupon

class ValidateCouponInputSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)


class CouponDetailSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_discount_type_display', read_only=True)

    class Meta:
        model = Coupon
        fields = ['code', 'discount_type', 'type_display', 'discount_value', 'min_order_amount', 'max_discount_amount']
