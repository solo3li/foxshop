from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class Coupon(models.Model):
    class DiscountTypes(models.TextChoices):
        PERCENT = 'PERCENT', 'نسبة مئوية (%)'
        FLAT = 'FLAT', 'مبلغ ثابت'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="كود الكوبون")
    discount_type = models.CharField(max_length=10, choices=DiscountTypes.choices, default=DiscountTypes.PERCENT)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="قيمة الخصم")
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="الحد الأدنى للطلب")
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="الحد الأقصى للخصم (لنسبة المئوية)")
    
    first_order_only = models.BooleanField(default=False, verbose_name="للطلب الأول فقط")
    is_active = models.BooleanField(default=True, verbose_name="مفعل")
    
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField()
    max_usage_per_user = models.PositiveIntegerField(default=1)

    def calculate_discount(self, subtotal):
        if subtotal < self.min_order_amount:
            return 0.00
        if self.discount_type == self.DiscountTypes.PERCENT:
            discount = (subtotal * self.discount_value) / 100
            if self.max_discount_amount and discount > self.max_discount_amount:
                discount = self.max_discount_amount
            return round(discount, 2)
        else: # FLAT
            return min(self.discount_value, subtotal)

    def __str__(self):
        return f"{self.code} ({self.discount_value} {self.get_discount_type_display()})"


class CouponUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coupon_usages')
    order_id = models.UUIDField()
    used_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} used {self.coupon.code}"
