from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.cache import cache
import uuid

class User(AbstractUser):
    class Roles(models.TextChoices):
        CUSTOMER = 'CUSTOMER', 'عميل'
        MERCHANT = 'MERCHANT', 'صاحب مطعم'
        DRIVER = 'DRIVER', 'كابتن توصيل'
        ADMIN = 'ADMIN', 'مدير نظام'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.CUSTOMER)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    @property
    def is_customer(self):
        return self.role == self.Roles.CUSTOMER

    @property
    def is_merchant(self):
        return self.role == self.Roles.MERCHANT

    @property
    def is_driver(self):
        return self.role == self.Roles.DRIVER

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Address(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    title = models.CharField(max_length=100, help_text="المنزل، العمل، إلخ")
    street = models.CharField(max_length=255)
    building_number = models.CharField(max_length=50, blank=True)
    floor = models.CharField(max_length=50, blank=True)
    apartment_number = models.CharField(max_length=50, blank=True)
    delivery_instructions = models.TextField(blank=True, help_text="اترك الطلب عند الباب")
    
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} - {self.user.username}"


class PlatformSetting(models.Model):
    """Singleton model for platform-wide settings (Google Maps Key, default radiuses, etc.)"""
    google_maps_server_key = models.CharField(max_length=255, blank=True, help_text="مفتاح Google Maps السري للباك إند (Geocoding / Distance Matrix)")
    google_maps_client_key = models.CharField(max_length=255, blank=True, help_text="مفتاح Google Maps العام لتطبيقات الهاتف والويب")
    default_search_radius_km = models.FloatField(default=10.0, help_text="نطاق البحث الافتراضي بالكيلومتر")
    cod_max_ceiling = models.DecimalField(max_digits=10, decimal_places=2, default=500.00, help_text="الحد الأقصى لمديونية الكاش المسموحة للكابتن")
    platform_commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=15.00, help_text="نسبة عمولة المنصة الافتراضية %")
    updated_at = models.DateTimeField(auto_now=True)

    CACHE_KEY = "foxshop_platform_settings"

    class Meta:
        verbose_name = "إعدادات المنصة و Google Maps"
        verbose_name_plural = "إعدادات المنصة و Google Maps"

    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton guarantee
        super().save(*args, **kwargs)
        cache.set(self.CACHE_KEY, self, timeout=86400)

    @classmethod
    def get_settings(cls):
        cached = cache.get(cls.CACHE_KEY)
        if cached:
            return cached
        settings, _ = cls.objects.get_or_create(pk=1)
        cache.set(cls.CACHE_KEY, settings, timeout=86400)
        return settings

    def __str__(self):
        return "إعدادات المنصة و Google Maps"
