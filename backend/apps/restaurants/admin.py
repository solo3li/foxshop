from django.contrib import admin
from django.utils.html import format_html
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
    list_display = (
        'name', 'store_type_badge', 'delivery_mode', 'owner',
        'currency', 'delivery_fee', 'delivery_radius_km', 'rating',
        'is_active', 'is_busy'
    )
    list_filter = ('store_type', 'delivery_mode', 'currency', 'is_active', 'is_busy')
    search_fields = ('name', 'owner__username', 'owner__phone_number')
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ('delivery_zones',)
    readonly_fields = ('rating', 'rating_count', 'created_at')
    inlines = [OperatingHoursInline]

    fieldsets = (
        ('بيانات المتجر والقطاع (Store & Sector Info)', {
            'fields': (
                ('name', 'slug'),
                ('store_type', 'delivery_mode'),
                'owner',
                ('logo', 'cover_image'),
                'description',
                ('is_active', 'is_busy'),
            )
        }),
        ('النطاق والموقع الجغرافي (Location & Zones)', {
            'fields': (
                'address_text',
                ('latitude', 'longitude'),
                'delivery_radius_km',
                'delivery_zones',
            )
        }),
        ('الإعدادات التشغيلية والمالية (Operations & Finance)', {
            'fields': (
                ('currency', 'min_order_amount'),
                ('delivery_fee', 'estimated_prep_time_minutes'),
            )
        }),
        ('التقييمات والإحصائيات (Ratings & Stats)', {
            'fields': (
                ('rating', 'rating_count'),
                'created_at',
            ),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description="نوع المتجر / القطاع", ordering='store_type')
    def store_type_badge(self, obj):
        badges = {
            Restaurant.StoreType.RESTAURANT: ('#fef3c7', '#b45309', '🍔 مطعم'),
            Restaurant.StoreType.SUPERMARKET: ('#dbeafe', '#1d4ed8', '🛒 سوبرماركت / بقالة'),
            Restaurant.StoreType.PHARMACY: ('#fce7f3', '#be185d', '💊 صيدلية'),
            Restaurant.StoreType.BUTCHERY_VEG: ('#dcfce7', '#15803d', '🥩 ملحمة وخضار'),
            Restaurant.StoreType.FLOWERS_GIFTS: ('#f3e8ff', '#7e22ce', '🎁 زهور وهدايا'),
            Restaurant.StoreType.GENERAL_RETAIL: ('#ffedd5', '#c2410c', '🛍️ متاجر تجزئة عامة'),
        }
        bg, text, label = badges.get(
            obj.store_type,
            ('#f1f5f9', '#475569', obj.get_store_type_display() or obj.store_type)
        )
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px; white-space: nowrap;">{}</span>',
            bg, text, label
        )
