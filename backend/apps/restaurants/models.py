from django.db import models
from django.conf import settings
from django.utils.text import slugify
import math
import uuid

def haversine_distance_km(lat1, lon1, lat2, lon2):
    """Calculates geographical distance between two GPS points in kilometers"""
    R = 6371.0 # Earth radius in km
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class Restaurant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_restaurants')
    name = models.CharField(max_length=255, verbose_name="اسم المطعم")
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True, verbose_name="وصف المطعم")
    logo = models.ImageField(upload_to='restaurants/logos/', null=True, blank=True)
    cover_image = models.ImageField(upload_to='restaurants/covers/', null=True, blank=True)
    
    address_text = models.CharField(max_length=255, verbose_name="العنوان النصي")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    
    delivery_radius_km = models.FloatField(default=10.0, verbose_name="نصف قطر التوصيل بالكيلومتر")
    currency = models.CharField(max_length=10, default='SAR', verbose_name="عملة المطعم (ديناميكية حسب المنطقة)")
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="الحد الأدنى للطلب")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=15.00, verbose_name="رسوم التوصيل الأساسية")
    estimated_prep_time_minutes = models.PositiveIntegerField(default=25, verbose_name="متوسط وقت التحضير بالدقائق")
    
    rating = models.FloatField(default=5.0)
    rating_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, verbose_name="متاح ومفعل")
    is_busy = models.BooleanField(default=False, verbose_name="وضع الذروة / المشغول")
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name, allow_unicode=True) or f"restaurant-{uuid.uuid4().hex[:6]}"
            slug = base_slug
            counter = 1
            while Restaurant.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def is_within_delivery_range(self, customer_lat, customer_lon):
        dist = haversine_distance_km(self.latitude, self.longitude, customer_lat, customer_lon)
        return dist <= self.delivery_radius_km, dist

    def __str__(self):
        return f"{self.name} ({self.currency})"


class DeliveryZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='delivery_zones')
    name = models.CharField(max_length=100, verbose_name="اسم النطاق")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    # GeoJSON coordinates list: [[lat, lng], [lat, lng], ...]
    polygon_coordinates = models.JSONField(default=list, help_text="مضلع النطاق الجغرافي GeoJSON Polygon")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"


class OperatingHours(models.Model):
    class Days(models.IntegerChoices):
        MONDAY = 0, 'الإثنين'
        TUESDAY = 1, 'الثلاثاء'
        WEDNESDAY = 2, 'الأربعاء'
        THURSDAY = 3, 'الخميس'
        FRIDAY = 4, 'الجمعة'
        SATURDAY = 5, 'السبت'
        SUNDAY = 6, 'الأحد'

    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='operating_hours')
    day = models.IntegerField(choices=Days.choices)
    opening_time = models.TimeField()
    closing_time = models.TimeField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        unique_together = ('restaurant', 'day')

    def __str__(self):
        return f"{self.restaurant.name} - {self.get_day_display()}"
