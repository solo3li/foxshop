from django.db import models
from django.conf import settings
from apps.restaurants.models import Restaurant
from apps.accounts.models import Address
from apps.menus.models import MenuItem, Modifier
import random
import uuid

class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'بانتظار موافقة المتجر'
        CONFIRMED = 'CONFIRMED', 'تم تأكيد الطلب'
        PREPARING = 'PREPARING', 'قيد التحضير'
        READY_FOR_PICKUP = 'READY_FOR_PICKUP', 'جاهز للاستلام'
        ON_THE_WAY = 'ON_THE_WAY', 'في الطريق مع الكابتن'
        DELIVERED = 'DELIVERED', 'تم التسليم بنجاح'
        CANCELLED = 'CANCELLED', 'تم الإلغاء'

    class PaymentMethod(models.TextChoices):
        COD = 'COD', 'الدفع عند الاستلام (كاش)'
        CARD = 'CARD', 'بطاقة إلكترونية'
        WALLET = 'WALLET', 'المحفظة الإلكترونية'

    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'معلق'
        PAID = 'PAID', 'مدفوع'
        FAILED = 'FAILED', 'فشل'
        REFUNDED = 'REFUNDED', 'مسترجع'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=20, unique=True, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='orders')
    delivery_address = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True)
    delivery_address_snapshot = models.JSONField(default=dict, help_text="نسخة محفوظة من العنوان وقت الطلب")
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.COD)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    
    currency = models.CharField(max_length=10, default='EGP')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    preauth_hold_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="مبلغ الحجز المسبق للوزن المتغير +15%")
    is_weight_confirmed = models.BooleanField(default=False, verbose_name="تم اعتماد الأوزان الفعلية")
    is_settled_with_merchant = models.BooleanField(default=False, verbose_name="تمت تسوية الكاش مع التاجر")
    is_commission_deducted = models.BooleanField(default=False, verbose_name="تم خصم عمولة المنصة")

    # Coupon & Promotions Tracking
    coupon = models.ForeignKey(
        'promotions.Coupon',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='orders',
        verbose_name="كوبون الخصم المستخدم"
    )
    coupon_code = models.CharField(max_length=50, blank=True, verbose_name="كود الكوبون")
    coupon_funded_by = models.CharField(max_length=20, blank=True, verbose_name="الجهة الممولة للخصم")

    # Dynamic Pricing & Zone Audit Fields
    delivery_zone = models.ForeignKey(
        'restaurants.DeliveryZone',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='orders',
        verbose_name="منطقة التوصيل"
    )
    delivery_distance_km = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.00,
        verbose_name="مسافة التوصيل المقدرة بالكم"
    )
    is_surge_applied = models.BooleanField(
        default=False,
        verbose_name="تم تطبيق رسوم ذروة"
    )
    surge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00,
        verbose_name="نسبة الذروة المطبقة %"
    )
    
    prep_time_minutes = models.PositiveIntegerField(default=25)
    customer_notes = models.TextField(blank=True, verbose_name="ملاحظات العميل للمتجر")
    cancellation_reason = models.CharField(max_length=255, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "طلب"
        verbose_name_plural = "إدارة الطلبات"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"FOX-{uuid.uuid4().hex[:14].upper()}"
        super().save(*args, **kwargs)

    def transition_to(self, new_status, note=""):
        old_status = self.status
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])
        OrderStatusHistory.objects.create(
            order=self,
            status=new_status,
            note=note or f"تغيرت الحالة من {old_status} إلى {new_status}"
        )

    def __str__(self):
        return f"{self.order_number} ({self.get_status_display()}) - {self.total_amount} {self.currency}"


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, null=True)
    item_name = models.CharField(max_length=200)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    requested_weight = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name="الوزن المطلوب")
    actual_weight = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name="الوزن الفعلي")
    is_weighted = models.BooleanField(default=False, verbose_name="صنف بالوزن المتغير")
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity}x {self.item_name}"


class OrderItemModifier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name='modifiers')
    modifier = models.ForeignKey(Modifier, on_delete=models.SET_NULL, null=True)
    modifier_name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"+ {self.modifier_name} ({self.price_delta})"


class OrderStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    status = models.CharField(max_length=30, choices=Order.Status.choices, default=Order.Status.PENDING)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.order.order_number} -> {self.status} at {self.created_at}"
