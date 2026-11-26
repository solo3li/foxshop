from django.db import models
from django.conf import settings
from apps.orders.models import Order
from decimal import Decimal
import random
import secrets
import datetime
import uuid
import math
from django.utils import timezone


def haversine_distance_km(lat1, lon1, lat2, lon2):
    """Calculates geographical distance between two GPS points in kilometers"""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class DriverProfile(models.Model):
    class VehicleTypes(models.TextChoices):
        MOTORCYCLE = 'MOTORCYCLE', 'دراجة نارية / سكوتر'
        CAR = 'CAR', 'سيارة'
        BICYCLE = 'BICYCLE', 'دراجة هوائية'

    class PriorityTier(models.TextChoices):
        GOLD = 'GOLD', 'فئة أولى / ذهبي'
        SILVER = 'SILVER', 'فئة ثانية / فضي'
        STANDARD = 'STANDARD', 'عادي / حر'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_profile')
    vehicle_type = models.CharField(max_length=20, choices=VehicleTypes.choices, default=VehicleTypes.MOTORCYCLE)
    license_plate = models.CharField(max_length=50, blank=True)
    
    is_online = models.BooleanField(default=False, verbose_name="متصل ومستعد للعمل")
    is_busy = models.BooleanField(default=False, verbose_name="في مهمة توصيل حالية")
    
    current_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    total_delivered_orders = models.PositiveIntegerField(default=0)
    rating = models.FloatField(default=5.0)
    cash_in_hand = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="المديونية الكاش المتراكمة")
    zone = models.ForeignKey('DeliveryZone', on_delete=models.SET_NULL, null=True, blank=True, related_name='drivers', verbose_name="المنطقة التشغيلية")
    
    # Hybrid Shift & Adherence Tracking Fields
    adherence_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('100.00'),
        verbose_name="نسبة الالتزام بالشفتات (%)"
    )
    priority_tier = models.CharField(
        max_length=20,
        choices=PriorityTier.choices,
        default=PriorityTier.STANDARD,
        verbose_name="شريحة أولوية الكابتن"
    )
    total_booked_shifts = models.PositiveIntegerField(
        default=0,
        verbose_name="إجمالي الشفتات المحجوزة"
    )
    attended_shifts = models.PositiveIntegerField(
        default=0,
        verbose_name="الشفتات الملتزم بها"
    )
    late_shifts = models.PositiveIntegerField(
        default=0,
        verbose_name="مرات التأخر"
    )
    absent_shifts = models.PositiveIntegerField(
        default=0,
        verbose_name="مرات الغياب"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def completed_shifts(self):
        return self.attended_shifts

    @completed_shifts.setter
    def completed_shifts(self, value):
        self.attended_shifts = value

    @property
    def missed_shifts(self):
        return self.absent_shifts

    @missed_shifts.setter
    def missed_shifts(self, value):
        self.absent_shifts = value

    def __str__(self):
        return f"كابتن: {self.user.username} ({self.get_vehicle_type_display()}) [{self.get_priority_tier_display()}]"


class PendingDriver(DriverProfile):
    class Meta:
        proxy = True
        verbose_name = "طلب انضمام كابتن جديد"
        verbose_name_plural = "طلبات انضمام الكباتن الجدد ⏳"


class DeliveryTrip(models.Model):
    class Status(models.TextChoices):
        DISPATCHING = 'DISPATCHING', 'جاري البحث عن كابتن آلياً'
        OFFERED = 'OFFERED', 'تم إرسال العرض للكابتن'
        ACCEPTED = 'ACCEPTED', 'الكابتن قبل الطلب ومتجه للمتجر'
        ARRIVED_AT_STORE = 'ARRIVED_AT_STORE', 'وصل إلى المتجر'
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
    driver_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    dispatch_attempts = models.PositiveIntegerField(default=0, verbose_name="عدد محاولات التعيين")
    last_offered_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='offered_trips', verbose_name="آخر كابتن عُرض عليه الطلب")

    offered_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # F17: Proof of Delivery photo for contactless completions
    pod_photo = models.ImageField(upload_to='deliveries/pod_photos/', null=True, blank=True, verbose_name="صورة إثبات التسليم")

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


class DeliveryOffer(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'بانتظار استجابة الكابتن ⏳'
        ACCEPTED = 'ACCEPTED', 'تم القبول من الكابتن ✅'
        REJECTED = 'REJECTED', 'تم الرفض يدوياً ❌'
        TIMED_OUT = 'TIMED_OUT', 'انتهت مهلة الرد ⏱️'
        EXPIRED = 'EXPIRED', 'سبقه كابتن آخر 💨'
        REVOKED = 'REVOKED', 'ملغي / مسحوب 🚫'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='delivery_offers', verbose_name="الطلب")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_offers', verbose_name="الكابتن")
    
    batch_number = models.PositiveIntegerField(default=1, verbose_name="رقم الدفعة")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name="حالة العرض")
    
    driver_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="أرباح الكابتن المقدرة")
    estimated_distance_km = models.FloatField(default=0.0, verbose_name="المسافة للمتجر (كم)")
    is_manual = models.BooleanField(default=False, verbose_name="مرسل يدوياً من الإدارة")
    
    offered_at = models.DateTimeField(auto_now_add=True, verbose_name="وقت إرسال العرض")
    expires_at = models.DateTimeField(verbose_name="وقت انتهاء الصلاحية")
    responded_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت الاستجابة")
    response_time_seconds = models.FloatField(null=True, blank=True, verbose_name="سرعة الاستجابة (ثواني)")

    class Meta:
        verbose_name = "عرض توصيل لكابتن"
        verbose_name_plural = "عروض التوصيل للكباتن 🎯"
        ordering = ['-offered_at']

    def __str__(self):
        return f"عرض طلب #{self.order.order_number} -> {self.driver.username} ({self.get_status_display()})"


class DriverCashSettlement(models.Model):
    class Status(models.TextChoices):
        APPROVED = 'APPROVED', 'معتمد ومورد'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'بانتظار موافقة مدير العمليات'
        REJECTED = 'REJECTED', 'مرفوض'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cash_settlements', verbose_name="الكابتن")
    supervisor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='supervised_settlements', verbose_name="المشرف المستلم")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="المبلغ المورد")
    balance_before = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="الرصيد قبل التوريد")
    balance_after = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="الرصيد بعد التوريد")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPROVED, verbose_name="حالة السند")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_cash_settlements', verbose_name="المدير المعتمد")
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت الاعتماد")
    rejection_reason = models.CharField(max_length=255, blank=True, verbose_name="سبب الرفض")
    notes = models.CharField(max_length=255, blank=True, verbose_name="ملاحظات / رقم السند")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التوريد")

    class Meta:
        verbose_name = "سند توريد كاش"
        verbose_name_plural = "سندات توريد الكاش للكباتن 💵"
        ordering = ['-created_at']

    def __str__(self):
        return f"توريد {self.amount} ج.م من {self.driver.username} [{self.get_status_display()}] ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class DeliveryZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name="اسم المنطقة / الزون")
    code = models.CharField(max_length=20, unique=True, verbose_name="كود المنطقة")
    city = models.CharField(max_length=100, default="القاهرة", verbose_name="المدينة")
    description = models.TextField(blank=True, verbose_name="وصف المنطقة")
    center_latitude = models.DecimalField(max_digits=9, decimal_places=6, verbose_name="خط العرض لمركز المنطقة")
    center_longitude = models.DecimalField(max_digits=9, decimal_places=6, verbose_name="خط الطول لمركز المنطقة")
    radius_km = models.FloatField(default=5.0, verbose_name="نطاق التغطية (كم)")
    polygon_coordinates = models.JSONField(default=list, blank=True, verbose_name="إحداثيات المضلع (اختياري)")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    supervisors = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='assigned_zones', blank=True, verbose_name="المشرفون المسؤولون")
    # F18: Relational reconciliation with restaurants.DeliveryZone
    restaurant_zone = models.ForeignKey(
        'restaurants.DeliveryZone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operational_zones',
        verbose_name="نطاق التوصيل التجاري المرتبط"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "منطقة تشغيل / زون"
        verbose_name_plural = "مناطق التشغيل والزونات 📍"
        ordering = ['city', 'name']

    def __str__(self):
        return f"{self.name} ({self.code}) - {self.city}"

    def contains_point(self, lat, lng) -> bool:
        """
        Check if a GPS coordinate (lat, lng) is within this delivery zone's radius.
        Uses Haversine distance formula against zone center.
        """
        if lat is None or lng is None:
            return False
        try:
            dist = haversine_distance_km(self.center_latitude, self.center_longitude, lat, lng)
            return dist <= float(self.radius_km)
        except (ValueError, TypeError):
            return False

    def distance_to_center(self, lat, lng) -> float:
        """
        Calculates Haversine distance in km from a given GPS point to zone center.
        """
        return haversine_distance_km(self.center_latitude, self.center_longitude, lat, lng)


class ShiftSlot(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'مسودة'
        PUBLISHED = 'PUBLISHED', 'منشور'
        ACTIVE = 'ACTIVE', 'جاري'
        COMPLETED = 'COMPLETED', 'مكتمل'
        CANCELLED = 'CANCELLED', 'ملغي'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(DeliveryZone, on_delete=models.CASCADE, related_name='shifts', verbose_name="منطقة التشغيل")
    name = models.CharField(max_length=100, verbose_name="اسم الشفت")
    date = models.DateField(verbose_name="تاريخ الشفت")
    start_time = models.TimeField(verbose_name="وقت البدء")
    end_time = models.TimeField(verbose_name="وقت الانتهاء")
    capacity = models.PositiveIntegerField(default=10, verbose_name="السعة القصوى للكباتن")
    booked_count = models.PositiveIntegerField(default=0, verbose_name="عدد الحجوزات المؤكدة")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PUBLISHED,
        verbose_name="حالة الشفت"
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط ومتاح للحجز")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "شفت عمل / وردية"
        verbose_name_plural = "شفتات العمل والورديات ⏰"
        ordering = ['date', 'start_time']

    def __str__(self):
        return f"{self.name} - {self.zone.name} ({self.date} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')})"

    @property
    def remaining_capacity(self):
        return max(0, self.capacity - self.booked_count)

    @property
    def is_full(self):
        return self.booked_count >= self.capacity

    @property
    def start_datetime(self):
        dt = datetime.datetime.combine(self.date, self.start_time)
        if settings.USE_TZ:
            tz = timezone.get_current_timezone()
            return timezone.make_aware(dt, tz) if not timezone.is_aware(dt) else dt
        return dt

    @property
    def end_datetime(self):
        end_date = self.date
        if self.end_time <= self.start_time:
            end_date = self.date + datetime.timedelta(days=1)
        dt = datetime.datetime.combine(end_date, self.end_time)
        if settings.USE_TZ:
            tz = timezone.get_current_timezone()
            return timezone.make_aware(dt, tz) if not timezone.is_aware(dt) else dt
        return dt


class DriverShiftBooking(models.Model):
    class Status(models.TextChoices):
        BOOKED = 'BOOKED', 'محجوز'
        CHECKED_IN = 'CHECKED_IN', 'حاضر بالمنطقة'
        COMPLETED = 'COMPLETED', 'مكتمل'
        CANCELLED = 'CANCELLED', 'ملغي'
        LATE = 'LATE', 'حاضر متأخر'
        ABSENT = 'ABSENT', 'غائب'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shift_bookings', verbose_name="الكابتن")
    shift = models.ForeignKey(ShiftSlot, on_delete=models.CASCADE, related_name='bookings', verbose_name="الشفت")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.BOOKED,
        verbose_name="حالة الحجز"
    )
    check_in_time = models.DateTimeField(null=True, blank=True, verbose_name="وقت تسجيل الحضور")
    check_out_time = models.DateTimeField(null=True, blank=True, verbose_name="وقت تسجيل الانصراف")
    check_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="خط عرض الحضور")
    check_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="خط طول الحضور")
    check_in_distance_km = models.FloatField(null=True, blank=True, verbose_name="المسافة من مركز الزون (كم)")
    is_geofence_verified = models.BooleanField(default=False, verbose_name="تم التحقق الجغرافي داخل النطاق")
    notes = models.CharField(max_length=255, blank=True, verbose_name="ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الحجز")

    class Meta:
        verbose_name = "حجز شفت كابتن"
        verbose_name_plural = "حجوزات شفتات الكباتن 📋"
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['driver', 'shift'],
                condition=models.Q(status__in=['BOOKED', 'CHECKED_IN', 'COMPLETED', 'LATE']),
                name='unique_active_driver_shift_booking'
            )
        ]

    def __str__(self):
        return f"حجز {self.driver.username} - {self.shift.name} [{self.get_status_display()}]"

    @property
    def booking_status(self):
        return self.status

    @booking_status.setter
    def booking_status(self, value):
        self.status = value

    @property
    def attendance_status(self):
        return self.status

    @attendance_status.setter
    def attendance_status(self, value):
        self.status = value


class SupervisorActionLog(models.Model):
    class ActionType(models.TextChoices):
        MANUAL_DISPATCH = 'MANUAL_DISPATCH', 'إسناد طلب يدوي'
        DRIVER_APPROVED = 'DRIVER_APPROVED', 'قبول وتفعيل كابتن'
        DRIVER_DEACTIVATED = 'DRIVER_DEACTIVATED', 'إلغاء تفعيل كابتن'
        DRIVER_STATUS_CHANGE = 'DRIVER_STATUS_CHANGE', 'تغيير حالة كابتن (أونلاين/مشغول)'
        CASH_SETTLED = 'CASH_SETTLED', 'تسوية وتوريد كاش مباشر'
        CASH_APPROVAL_REQUESTED = 'CASH_APPROVAL_REQUESTED', 'طلب اعتماد تسوية كاش كبيرة'
        CASH_APPROVED = 'CASH_APPROVED', 'اعتماد تسوية كاش من المدير'
        CASH_REJECTED = 'CASH_REJECTED', 'رفض تسوية كاش من المدير'
        SUPERVISOR_CREATED = 'SUPERVISOR_CREATED', 'إنشاء حساب مشرف جديد'
        SUPERVISOR_STATUS_TOGGLE = 'SUPERVISOR_STATUS_TOGGLE', 'تعديل حالة حساب مشرف'
        ZONE_CREATED = 'ZONE_CREATED', 'إنشاء منطقة تشغيل جديدة'
        ZONE_ASSIGNED = 'ZONE_ASSIGNED', 'تعيين مشرفين لمنطقة تشغيل'
        COD_CEILING_UPDATED = 'COD_CEILING_UPDATED', 'تعديل سقف مديونية الكاش'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='supervisor_action_logs', verbose_name="القائم بالإجراء")
    actor_role = models.CharField(max_length=30, blank=True, verbose_name="رتبة القائم بالإجراء")
    action_type = models.CharField(max_length=50, choices=ActionType.choices, verbose_name="نوع الإجراء")
    target_type = models.CharField(max_length=50, blank=True, verbose_name="نوع العنصر المستهدف")
    target_id = models.CharField(max_length=100, blank=True, verbose_name="معرّف الهدف")
    target_name = models.CharField(max_length=255, blank=True, verbose_name="اسم/وصف الهدف")
    details = models.JSONField(default=dict, blank=True, verbose_name="تفاصيل إضافية")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="عنوان IP")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="وقت الإجراء")

    class Meta:
        verbose_name = "سجل رقابة العمليات"
        verbose_name_plural = "سجلات رقابة وتدقيق المشرفين 📋"
        ordering = ['-created_at']

    def __str__(self):
        actor_name = self.actor.username if self.actor else "مجهول"
        return f"[{self.get_action_type_display()}] بواسطة {actor_name} على {self.target_name or self.target_type} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class ShiftSettlement(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'بانتظار تسليم الكاش والتحقق'
        COMPLETED = 'COMPLETED', 'تم تسليم الكاش بنجاح'
        CANCELLED = 'CANCELLED', 'ملغي'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='shift_settlements', verbose_name="المتجر / المطعم")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='merchant_shift_settlements', verbose_name="الكابتن")
    orders = models.ManyToManyField(Order, related_name='shift_settlements', blank=True, verbose_name="الطلبات المسلمة")
    orders_count = models.PositiveIntegerField(default=0, verbose_name="عدد الطلبات")
    total_goods_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="إجمالي قيمة البضائع (100%)")
    platform_commission_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="عمولة المنصة المخصومة من التاجر")
    otp_code = models.CharField(max_length=6, verbose_name="رمز التحقق (OTP) للتسليم")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name="حالة التسوية")
    settled_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت إتمام التسوية")
    notes = models.CharField(max_length=255, blank=True, verbose_name="ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "تسوية شفت كاش للمتجر"
        verbose_name_plural = "تسويات شفتات الكاش للمتاجر 💵"
        ordering = ['-created_at']

    @property
    def is_expired(self):
        """Returns True if the OTP has exceeded the 2-hour validity window."""
        return timezone.now() > self.created_at + datetime.timedelta(hours=2)

    def save(self, *args, **kwargs):
        if not self.otp_code:
            self.otp_code = f"{secrets.randbelow(900000) + 100000}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"تسوية #{str(self.id)[:8]} - كابتن {self.driver.username} مع متجر {self.restaurant.name} ({self.total_goods_amount} ج.م)"

