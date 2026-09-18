from django.contrib import admin
from .models import Restaurant, DeliveryZone, OperatingHours

class OperatingHoursInline(admin.TabularInline):
    model = OperatingHours
    extra = 7

try:
    from django.contrib.gis.admin import GISModelAdmin
    from django.contrib.gis.forms.widgets import OSMWidget

    class DeliveryZoneOSMWidget(OSMWidget):
        template_name = "gis/admin/delivery_zone_map.html"
        default_lon = 46.6753
        default_lat = 24.7136
        default_zoom = 11

    BaseDeliveryZoneAdmin = GISModelAdmin
    has_gis_admin = True
except Exception:
    BaseDeliveryZoneAdmin = admin.ModelAdmin
    has_gis_admin = False


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(BaseDeliveryZoneAdmin):
    list_display = (
        'name', 'city', 'currency', 'base_delivery_fee', 'base_distance_km',
        'per_km_fee', 'max_delivery_fee', 'is_manual_surge_active', 'is_active'
    )
    list_filter = ('city', 'currency', 'is_manual_surge_active', 'is_auto_surge_enabled', 'is_active')
    search_fields = ('name', 'city')
    readonly_fields = ('polygon_coordinates',)

    fieldsets = (
        ('المعلومات الأساسية', {
            'fields': ('name', 'city', 'currency', 'is_active')
        }),
        ('التسعير الديناميكي للمسافة (Tiered Distance Pricing)', {
            'fields': ('base_delivery_fee', 'base_distance_km', 'per_km_fee', 'max_delivery_fee'),
            'description': 'المعادلة: الرسوم الأساسية + (المسافة الفعلية - المسافة الأساسية) × سعر الكم الإضافي، بما لا يتجاوز الحد الأقصى.'
        }),
        ('إدارة الذروة والطقس (Surge Pricing %)', {
            'fields': (
                'is_manual_surge_active', 'manual_surge_percent',
                'is_auto_surge_enabled', 'auto_surge_percent', 'auto_surge_threshold_ratio'
            ),
            'description': 'تُضاف نسب الذروة كنسب مئوية % من قيمة التوصيل المحسوبة.'
        }),
        ('حدود النطاق الجغرافي على الخريطة', {
            'fields': ('polygon', 'polygon_coordinates') if has_gis_admin else ('polygon_coordinates',),
        }),
    )

    if has_gis_admin:
        gis_widget = DeliveryZoneOSMWidget

@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'currency', 'delivery_fee', 'delivery_radius_km', 'rating', 'is_active', 'is_busy')
    list_filter = ('currency', 'is_active', 'is_busy')
    search_fields = ('name', 'owner__username')
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ('delivery_zones',)
    inlines = [OperatingHoursInline]
