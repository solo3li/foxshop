from django.db import models
from django.conf import settings
from django.utils.text import slugify
from decimal import Decimal
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


try:
    from django.contrib.gis.db import models as gis_models
    GIS_AVAILABLE = True
except Exception:
    GIS_AVAILABLE = False


class DeliveryZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name="اسم المنطقة / النطاق")
    city = models.CharField(max_length=100, default='الرياض', verbose_name="المدينة")
    currency = models.ForeignKey(
        'payments.Currency',
        on_delete=models.PROTECT,
        related_name='delivery_zones',
        default='SAR',
        verbose_name="العملة المعتمدة للمنطقة",
        help_text="اختر العملة المعتمدة لهذه المنطقة من قائمة عملات المنصة"
    )
    base_delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=15.00, verbose_name="رسوم التوصيل الأساسية للمنطقة")
    base_distance_km = models.DecimalField(max_digits=5, decimal_places=2, default=3.00, verbose_name="المسافة الأساسية المشمولة (كم)", help_text="المسافة المشمولة ضمن الرسوم الأساسية (مثلاً أول 3 كم)")
    per_km_fee = models.DecimalField(max_digits=5, decimal_places=2, default=1.50, verbose_name="سعر الكيلومتر الإضافي", help_text="الرسوم المضافة لكل كيلومتر بعد المسافة الأساسية")
    max_delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=35.00, verbose_name="الحد الأقصى لرسوم التوصيل", help_text="سقف أقصى لرسوم التوصيل لمنع المبالغة في الأسعار")

    # Surge Pricing Settings
    is_manual_surge_active = models.BooleanField(default=False, verbose_name="تفعيل ذروة الطوارئ/الطقس يدوياً", help_text="تفعيل فوري لرسوم إضافية للمنطقة بسبب الأمطار أو سوء الأحوال الجوية")
    manual_surge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20.00, verbose_name="نسبة زيادة ذروة الطقس %")
    is_auto_surge_enabled = models.BooleanField(default=True, verbose_name="تفعيل الذروة التلقائية حسب العرض والطلب")
    auto_surge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=25.00, verbose_name="نسبة زيادة الذروة التلقائية %")
    auto_surge_threshold_ratio = models.DecimalField(max_digits=4, decimal_places=2, default=2.00, verbose_name="معامل عتبة الذروة (الطلبات / الكباتن)", help_text="تتفعل الذروة إذا كان عدد الطلبات الجارية >= ضعف عدد الكباتن المتاحين")
    
    if GIS_AVAILABLE:
        polygon = gis_models.PolygonField(
            srid=4326,
            null=True,
            blank=True,
            verbose_name="مضلع النطاق على الخريطة",
            help_text="انقر على الخريطة لرسم حدود المنطقة، وانقر مرتين لإغلاق المضلع."
        )

    polygon_coordinates = models.JSONField(
        default=list,
        blank=True,
        verbose_name="إحداثيات المضلع (GeoJSON)",
        help_text="يتم توليدها وتحديثها تلقائياً من الخريطة بصيغة [[lat, lng], ...]"
    )
    is_active = models.BooleanField(default=True, verbose_name="مفعلة للتوصيل")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "منطقة توصيل"
        verbose_name_plural = "مناطق التوصيل"
        ordering = ['city', 'name']

    def save(self, *args, **kwargs):
        if GIS_AVAILABLE and hasattr(self, 'polygon') and self.polygon:
            try:
                if hasattr(self.polygon, 'coords') and self.polygon.coords:
                    self.polygon_coordinates = [[float(lat), float(lng)] for lng, lat in self.polygon.coords[0]]
            except Exception:
                pass
        super().save(*args, **kwargs)

    @property
    def coordinates_list(self):
        if self.polygon_coordinates:
            return self.polygon_coordinates
        if GIS_AVAILABLE and hasattr(self, 'polygon') and self.polygon:
            try:
                if hasattr(self.polygon, 'coords') and self.polygon.coords:
                    return [[float(lat), float(lng)] for lng, lat in self.polygon.coords[0]]
            except Exception:
                pass
        return []

    def contains_point(self, lat, lng):
        """Checks if a GPS coordinate (lat, lng) falls within this delivery zone."""
        lat = float(lat)
        lng = float(lng)

        # 1. Try PostGIS spatial polygon check if available
        if GIS_AVAILABLE and hasattr(self, 'polygon') and self.polygon:
            try:
                from django.contrib.gis.geos import Point
                point = Point(lng, lat, srid=4326)
                if self.polygon.contains(point):
                    return True
            except Exception:
                pass

        # 2. Fallback to Ray-Casting algorithm on polygon_coordinates GeoJSON list
        coords = self.coordinates_list
        if not coords or len(coords) < 3:
            return False

        n = len(coords)
        inside = False
        p1_lat, p1_lng = coords[0]
        for i in range(1, n + 1):
            p2_lat, p2_lng = coords[i % n]
            if min(p1_lat, p2_lat) < lat <= max(p1_lat, p2_lat):
                if lng <= max(p1_lng, p2_lng):
                    if p1_lat != p2_lat:
                        xinters = (lat - p1_lat) * (p2_lng - p1_lng) / (p2_lat - p1_lat) + p1_lng
                    else:
                        xinters = p1_lng
                    if p1_lng == p2_lng or lng <= xinters:
                        inside = not inside
            p1_lat, p1_lng = p2_lat, p2_lng

        return inside

    def __str__(self):
        curr_code = getattr(self.currency, 'code', str(self.currency))
        return f"{self.city} - {self.name} ({curr_code})"


def calculate_dynamic_delivery_fee(restaurant, customer_lat, customer_lng):
    """
    Calculates dynamic delivery fee based on:
    - Tiered distance formula: Base Fee + max(0, Driving Distance - Base Km) * Rate/Km
    - Driving Distance = Straight Line (Haversine) * 1.25 (Road Curvature Factor)
    - Matched DeliveryZone based on customer GPS
    - Surge Multiplier (Manual Weather Surge + Automated Demand/Supply Surge)
    - Upper Cap (max_delivery_fee)
    """
    c_lat = float(customer_lat)
    c_lng = float(customer_lng)
    
    # 1. Calculate distance
    straight_dist = haversine_distance_km(restaurant.latitude, restaurant.longitude, c_lat, c_lng)
    driving_dist = Decimal(str(round(straight_dist * 1.25, 2)))

    # 2. Resolve DeliveryZone
    matched_zone = None
    restaurant_zones = restaurant.delivery_zones.filter(is_active=True)
    for zone in restaurant_zones:
        if zone.contains_point(c_lat, c_lng):
            matched_zone = zone
            break

    # Fallback to first active restaurant zone if none matches polygon directly
    if not matched_zone:
        matched_zone = restaurant_zones.first()

    base_fee = matched_zone.base_delivery_fee if matched_zone else restaurant.delivery_fee
    base_km = matched_zone.base_distance_km if matched_zone else Decimal('3.00')
    per_km_fee = matched_zone.per_km_fee if matched_zone else Decimal('1.50')
    max_fee = matched_zone.max_delivery_fee if matched_zone else Decimal('35.00')

    # 3. Distance-based Tiered Fee
    extra_km = max(Decimal('0.00'), driving_dist - base_km)
    distance_fee = base_fee + (extra_km * per_km_fee)

    # 4. Surge Pricing Evaluation
    surge_percent = Decimal('0.00')
    is_surge = False

    if matched_zone:
        # A. Manual Surge (Weather/Emergency)
        if matched_zone.is_manual_surge_active:
            surge_percent += matched_zone.manual_surge_percent
            is_surge = True

        # B. Automatic Surge (Demand / Supply Imbalance)
        if matched_zone.is_auto_surge_enabled:
            from apps.deliveries.models import DriverProfile, DeliveryTrip
            
            # Active pending or dispatching trips in this zone
            active_trips_count = DeliveryTrip.objects.filter(
                order__delivery_zone=matched_zone,
                status__in=[
                    DeliveryTrip.Status.DISPATCHING,
                    DeliveryTrip.Status.OFFERED,
                    DeliveryTrip.Status.ACCEPTED,
                    DeliveryTrip.Status.ARRIVED_AT_STORE
                ]
            ).count()

            # Online and ready drivers
            online_drivers_count = DriverProfile.objects.filter(
                is_online=True,
                is_busy=False
            ).count()

            threshold = float(matched_zone.auto_surge_threshold_ratio)
            if active_trips_count >= (max(1, online_drivers_count) * threshold):
                surge_percent += matched_zone.auto_surge_percent
                is_surge = True

    # Limit maximum total surge to 100% (+100% max increase)
    surge_percent = min(Decimal('100.00'), surge_percent)
    surge_multiplier = Decimal('1.00') + (surge_percent / Decimal('100.00'))
    
    fee_before_cap = distance_fee * surge_multiplier
    final_fee = min(fee_before_cap, max_fee)
    final_fee = round(final_fee, 2)

    return {
        'delivery_fee': final_fee,
        'driving_distance_km': driving_dist,
        'straight_distance_km': Decimal(str(round(straight_dist, 2))),
        'base_fee': base_fee,
        'extra_km_fee': round(extra_km * per_km_fee, 2),
        'surge_percent': surge_percent,
        'is_surge_applied': is_surge,
        'zone': matched_zone
    }



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
    currency = models.ForeignKey(
        'payments.Currency',
        on_delete=models.PROTECT,
        related_name='restaurants',
        default='SAR',
        verbose_name="عملة المطعم",
        help_text="العملة المعتمدة لأسعار المطعم"
    )
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="الحد الأدنى للطلب")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=15.00, verbose_name="رسوم التوصيل الأساسية")
    estimated_prep_time_minutes = models.PositiveIntegerField(default=25, verbose_name="متوسط وقت التحضير بالدقائق")
    
    delivery_zones = models.ManyToManyField(
        DeliveryZone,
        related_name='restaurants',
        blank=True,
        verbose_name="مناطق التوصيل المغطاة"
    )

    rating = models.FloatField(default=5.0)
    rating_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, verbose_name="متاح ومفعل")
    is_busy = models.BooleanField(default=False, verbose_name="وضع الذروة / المشغول")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "مطعم"
        verbose_name_plural = "المطاعم"

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
        curr_code = getattr(self.currency, 'code', str(self.currency))
        return f"{self.name} ({curr_code})"


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
