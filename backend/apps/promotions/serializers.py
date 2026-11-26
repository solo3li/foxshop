from rest_framework import serializers
from django.utils import timezone
from decimal import Decimal
from .models import Coupon, CouponUsage

class ValidateCouponInputSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=Decimal('0.00'))
    restaurant_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class CouponDetailSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True, default=None)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'type_display', 'discount_value',
            'min_order_amount', 'max_discount_amount', 'first_order_only',
            'is_active', 'valid_from', 'valid_to', 'funded_by',
            'restaurant', 'restaurant_name'
        ]


class MerchantCouponSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    usage_count = serializers.SerializerMethodField()
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'type_display', 'discount_value',
            'min_order_amount', 'max_discount_amount', 'first_order_only',
            'is_active', 'valid_from', 'valid_to', 'max_usage_per_user',
            'usage_count', 'funded_by', 'restaurant', 'restaurant_name'
        ]
        read_only_fields = ['id', 'funded_by', 'restaurant', 'restaurant_name', 'usage_count']

    def get_usage_count(self, obj):
        return obj.usages.count()

    def validate_code(self, value):
        code = value.strip().upper()
        qs = Coupon.objects.filter(code=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("كود الكوبون هذا مستخدم بالفعل، يرجى اختيار كود آخر.")
        return code

    def validate(self, attrs):
        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', None))
        discount_value = attrs.get('discount_value', getattr(self.instance, 'discount_value', Decimal('0.00')))

        if discount_type == Coupon.DiscountTypes.PERCENT:
            if discount_value <= Decimal('0.00') or discount_value > Decimal('100.00'):
                raise serializers.ValidationError({"discount_value": "نسبة الخصم يجب أن تكون بين 1% و 100%."})

        valid_from = attrs.get('valid_from', getattr(self.instance, 'valid_from', timezone.now()))
        valid_to = attrs.get('valid_to', getattr(self.instance, 'valid_to', None))
        if valid_to and valid_from and valid_to <= valid_from:
            raise serializers.ValidationError({"valid_to": "تاريخ نهاية صلاحية الكوبون يجب أن يكون بعد تاريخ البداية."})

        return attrs
