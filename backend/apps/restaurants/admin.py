import json
from django import forms
from django.contrib import admin
from django.utils.html import format_html
from .models import Restaurant, DeliveryZone, OperatingHours, StoreSector


class GooglePolygonWidget(forms.Widget):
    template_name = 'admin/restaurants/google_polygon_widget.html'

    def __init__(self, current_zone_id=None, attrs=None):
        self.current_zone_id = current_zone_id
        super().__init__(attrs)

    def format_value(self, value):
        if value is None or value == '':
            return '[]'
        if isinstance(value, str):
            return value
        return json.dumps(value)

    def value_from_datadict(self, data, files, name):
        raw = data.get(name, '[]')
        try:
            parsed = json.loads(raw or '[]')
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        from apps.accounts.models import PlatformSetting
        setting = PlatformSetting.get_settings()
        other_zones = []
        qs = DeliveryZone.objects.filter(is_active=True)
        if self.current_zone_id:
            qs = qs.exclude(pk=self.current_zone_id)
        for z in qs:
            if z.coordinates_list and len(z.coordinates_list) >= 3:
                other_zones.append({'name': z.name, 'coords': z.coordinates_list})

        context['google_maps_key'] = getattr(setting, 'google_maps_client_key', '') or ''
        context['other_zones_json'] = json.dumps(other_zones)
        context['default_lat'] = 24.7136
        context['default_lng'] = 46.6753
        return context


class DeliveryZoneAdminForm(forms.ModelForm):
    class Meta:
        model = DeliveryZone
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['polygon_coordinates'].widget = GooglePolygonWidget(
            current_zone_id=self.instance.pk if self.instance else None
        )


class IconifySvgPickerWidget(forms.Widget):
    template_name = 'admin/restaurants/iconify_svg_picker_widget.html'


class StoreSectorAdminForm(forms.ModelForm):
    class Meta:
        model = StoreSector
        fields = '__all__'
        widgets = {
            'icon_svg': IconifySvgPickerWidget(),
        }


@admin.register(StoreSector)
class StoreSectorAdmin(admin.ModelAdmin):
    form = StoreSectorAdminForm
    list_display = ('name', 'short_title', 'code', 'icon_name', 'sort_order', 'stores_count', 'is_active')
    list_editable = ('sort_order', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'short_title', 'code')
    ordering = ('sort_order', 'name')

    fieldsets = (
        ('بيانات القسم الأساسية', {
            'fields': (
                ('name', 'short_title'),
                ('code', 'sort_order', 'is_active'),
                'search_placeholder',
            )
        }),
        ('الأيقونة والصورة', {
            'fields': (
                'icon_svg',
                'icon_name',
                'image_url',
                'image',
            ),
            'description': 'ابحث واختر أيقونة SVG احترافية من مكتبة Iconify أو ارفع صورة القسم ليظهر تلقائياً في تطبيق العميل.'
        }),
    )

    @admin.display(description="عدد المتاجر")
    def stores_count(self, obj):
        return obj.restaurants.count()

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
class DeliveryZoneAdmin(admin.ModelAdmin):
    form = DeliveryZoneAdminForm
    list_display = (
        'name', 'city', 'currency', 'base_delivery_fee', 'base_distance_km',
        'per_km_fee', 'max_delivery_fee', 'is_manual_surge_active', 'is_active'
    )
    list_filter = ('city', 'currency', 'is_manual_surge_active', 'is_auto_surge_enabled', 'is_active')
    search_fields = ('name', 'city')

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
        ('حدود النطاق الجغرافي على خرائط جوجل', {
            'fields': ('polygon_coordinates',),
        }),
    )

class GoogleStoreLocationWidget(forms.Widget):
    template_name = 'admin/restaurants/google_store_location_widget.html'

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        from apps.accounts.models import PlatformSetting
        setting = PlatformSetting.get_settings()
        zones = []
        for z in DeliveryZone.objects.filter(is_active=True):
            if z.coordinates_list and len(z.coordinates_list) >= 3:
                zones.append({
                    'id': str(z.id),
                    'name': z.name,
                    'coords': z.coordinates_list,
                })
        default_lat = 30.0444
        default_lng = 31.2357
        if zones:
            pts = zones[0]['coords']
            default_lat = sum(float(p[0]) for p in pts) / len(pts)
            default_lng = sum(float(p[1]) for p in pts) / len(pts)

        context['google_maps_key'] = getattr(setting, 'google_maps_client_key', '') or ''
        context['zones_json'] = json.dumps(zones)
        context['default_lat'] = default_lat
        context['default_lng'] = default_lng
        return context


class RestaurantAdminForm(forms.ModelForm):
    map_picker = forms.CharField(
        required=False,
        label='تحديد موقع المتجر على الخريطة',
        widget=GoogleStoreLocationWidget(),
    )

    class Meta:
        model = Restaurant
        fields = '__all__'


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    form = RestaurantAdminForm
    list_display = (
        'name', 'store_type_badge', 'delivery_mode', 'owner',
        'currency', 'delivery_fee', 'delivery_radius_km', 'rating',
        'is_active', 'is_busy'
    )
    list_filter = ('sector', 'store_type', 'delivery_mode', 'currency', 'is_active', 'is_busy')
    search_fields = ('name', 'owner__username', 'owner__phone_number')
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ('delivery_zones',)
    readonly_fields = ('rating', 'rating_count', 'created_at')
    inlines = [OperatingHoursInline]

    fieldsets = (
        ('بيانات المتجر والقطاع (Store & Sector Info)', {
            'fields': (
                ('name', 'slug'),
                ('sector', 'store_type', 'delivery_mode'),
                'owner',
                ('logo', 'cover_image'),
                'description',
                ('is_active', 'is_busy'),
            )
        }),
        ('النطاق والموقع الجغرافي (Location & Zones)', {
            'fields': (
                'map_picker',
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
            ('#f1f5f9', '#475569', obj.sector.name if obj.sector else obj.store_type)
        )
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px; white-space: nowrap;">{}</span>',
            bg, text, label
        )
