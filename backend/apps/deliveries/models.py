from django.db import models
from django.conf import settings
from apps.orders.models import Order
import random
import uuid

class DriverProfile(models.Model):
    class VehicleTypes(models.TextChoices):
        MOTORCYCLE = 'MOTORCYCLE', 'دراجة نارية / سكوتر'
        CAR = 'CAR', 'سيارة'
        BICYCLE = 'BICYCLE', 'دراجة هوائية'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_profile')
    vehicle_type = models.CharField(max_length=20, choices=VehicleTypes.choices, default=VehicleTypes.MOTORCYCLE)
    license_plate = models.CharField(max_length=50, blank=True)
    
    is_online = models.BooleanField(default=False, verbose_name="متصل ومستعد للعمل")
    is_busy = models.BooleanField(default=False, verbose_name="في مهمة توصيل حالية")
    
    current_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    total_delivered_orders = models.PositiveIntegerField(default=0)
    rating = models.FloatField(default=5.0)
    cash_in_hand = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="المديونية الكاش المتراكمة")
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"كابتن: {self.user.username} ({self.get_vehicle_type_display()})"


class DeliveryTrip(models.Model):
    class Status(models.TextChoices):
        DISPATCHING = 'DISPATCHING', 'جاري البحث عن كابتن آلياً'
        OFFERED = 'OFFERED', 'تم إرسال العرض للكابتن'
        ACCEPTED = 'ACCEPTED', 'الكابتن قبل الطلب ومتجه للمطعم'
        ARRIVED_AT_STORE = 'ARRIVED_AT_STORE', 'وصل إلى المطعم'
        PICKED_UP = 'PICKED_UP', 'استلم الطلب وفي الطريق للعميل'
        ARRIVED_AT_CUSTOMER = 'ARRIVED_AT_CUSTOMER', 'وصل إلى موقع العميل'
        COMPLETED = 'COMPLETED', 'تم التسليم بنجاح'
        MANUAL_DISPATCH_REQUIRED = 'MANUAL_DISPATCH_REQUIRED', 'مطلوب تعيين يدوي (فشل آلي)'
        CANCELLED = 'CANCELLED', 'تم إلغاء مهمة التوصيل'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery_trip')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_trips')
    
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DISPATCHING)
    delivery_otp = models.CharField(max_length=6, editable=False, help_text="كود التحقق لإثبات التسليم")
    
    distance_km = models.FloatField(default=0.0)
    driver_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    dispatch_attempts = models.PositiveIntegerField(default=0, verbose_name="عدد محاولات التعيين")
    last_offered_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='offered_trips', verbose_name="آخر كابتن عُرض عليه الطلب")

    offered_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.delivery_otp:
            self.delivery_otp = str(random.randint(1000, 9999))
        super().save(*args, **kwargs)

    def verify_otp_and_complete(self, entered_otp):
        if str(entered_otp).strip() == str(self.delivery_otp).strip():
            self.status = self.Status.COMPLETED
            from django.utils import timezone
            self.completed_at = timezone.now()
            self.save(update_fields=['status', 'completed_at'])
            
            # Update order status
            self.order.transition_to(Order.Status.DELIVERED, note=f"تم التسليم بنجاح بواسطة الكابتن {self.driver.username}")
            
            # Update driver profile
            if hasattr(self.driver, 'driver_profile'):
                profile = self.driver.driver_profile
                profile.is_busy = False
                profile.total_delivered_orders += 1
                if self.order.payment_method == Order.PaymentMethod.COD:
                    profile.cash_in_hand += self.order.total_amount
                profile.save()
            return True
        return False

    def __str__(self):
        return f"رحلة طلب {self.order.order_number} ({self.get_status_display()})"
