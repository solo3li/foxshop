from rest_framework import serializers
from .models import Restaurant, DeliveryZone, OperatingHours, calculate_dynamic_delivery_fee
from apps.menus.models import MenuItem

class OperatingHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_display', read_only=True)

    class Meta:
        model = OperatingHours
        fields = ['day', 'day_name', 'opening_time', 'closing_time', 'is_closed']


class DeliveryZoneSerializer(serializers.ModelSerializer):
    polygon_coordinates = serializers.ReadOnlyField(source='coordinates_list')
    currency = serializers.CharField(source='currency_id', read_only=True)

    class Meta:
        model = DeliveryZone
        fields = [
            'id', 'name', 'city', 'currency', 'base_delivery_fee',
            'base_distance_km', 'per_km_fee', 'max_delivery_fee',
            'is_manual_surge_active', 'manual_surge_percent',
            'is_auto_surge_enabled', 'polygon_coordinates', 'is_active'
        ]


def _clean_image_url(val):
    if not val:
        return val
    if '/media/http' in val:
        import urllib.parse
        idx = val.find('/media/http')
        unquoted = urllib.parse.unquote(val[idx + len('/media/'):])
        if unquoted.startswith('https:/') and not unquoted.startswith('https://'):
            return unquoted.replace('https:/', 'https://', 1)
        if unquoted.startswith('http:/') and not unquoted.startswith('http://'):
            return unquoted.replace('http:/', 'http://', 1)
        return unquoted
    return val


class RestaurantListSerializer(serializers.ModelSerializer):
    distance_km = serializers.SerializerMethodField(required=False)
    delivery_fee = serializers.SerializerMethodField()
    currency = serializers.CharField(source='currency_id', read_only=True)

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'description', 'logo', 'cover_image',
            'store_type', 'delivery_mode',
            'rating', 'rating_count', 'delivery_fee', 'estimated_prep_time_minutes',
            'currency', 'is_busy', 'distance_km'
        ]

    def get_distance_km(self, obj):
        return getattr(obj, 'computed_distance', None)

    def get_delivery_fee(self, obj):
        request = self.context.get('request')
        if request:
            lat = request.query_params.get('lat')
            lng = request.query_params.get('lng')
            if lat and lng:
                try:
                    fee_info = calculate_dynamic_delivery_fee(obj, lat, lng)
                    return float(fee_info['delivery_fee'])
                except Exception:
                    pass
        return float(obj.delivery_fee)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        for field in ['cover_image', 'logo']:
            ret[field] = _clean_image_url(ret.get(field))
        return ret


class RestaurantDetailSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(source='currency_id', read_only=True)
    operating_hours = OperatingHoursSerializer(many=True, read_only=True)
    delivery_zones = DeliveryZoneSerializer(many=True, read_only=True)
    delivery_fee = serializers.SerializerMethodField()
    is_deliverable = serializers.SerializerMethodField()
    delivery_restriction_message = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'description', 'logo', 'cover_image',
            'store_type', 'delivery_mode',
            'address_text', 'latitude', 'longitude', 'delivery_radius_km',
            'currency', 'min_order_amount', 'delivery_fee', 'estimated_prep_time_minutes',
            'rating', 'rating_count', 'is_active', 'is_busy', 'operating_hours', 'delivery_zones',
            'is_deliverable', 'delivery_restriction_message'
        ]
        read_only_fields = ['id', 'slug', 'rating', 'rating_count']

    def _get_coords(self):
        request = self.context.get('request')
        if request:
            lat = request.query_params.get('lat')
            lng = request.query_params.get('lng')
            if lat is not None and lng is not None:
                try:
                    return float(lat), float(lng)
                except (ValueError, TypeError):
                    return None
        return None

    def get_is_deliverable(self, obj):
        coords = self._get_coords()
        if coords is not None:
            lat, lng = coords
            in_range, _ = obj.is_within_delivery_range(lat, lng)
            return in_range
        return True

    def get_delivery_restriction_message(self, obj):
        coords = self._get_coords()
        if coords is not None:
            lat, lng = coords
            in_range, dist = obj.is_within_delivery_range(lat, lng)
            if not in_range:
                if obj.delivery_zones.filter(is_active=True).exists():
                    return "عذراً، هذا المتجر لا يغطي موقعك الحالي حيث يقع خارج مناطق التوصيل المعتمدة لديه"
                return f"عذراً، هذا المتجر لا يغطي موقعك الحالي حيث يقع خارج مناطق التوصيل المعتمدة لديه (المسافة: {round(dist, 1)} كم)"
        return None

    def get_delivery_fee(self, obj):
        request = self.context.get('request')
        if request:
            lat = request.query_params.get('lat')
            lng = request.query_params.get('lng')
            if lat and lng:
                try:
                    fee_info = calculate_dynamic_delivery_fee(obj, lat, lng)
                    return float(fee_info['delivery_fee'])
                except Exception:
                    pass
        return float(obj.delivery_fee)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        for field in ['cover_image', 'logo']:
            ret[field] = _clean_image_url(ret.get(field))
        return ret


class SearchProductSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    base_price = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()
    restaurant_id = serializers.UUIDField(source='category.restaurant.id', read_only=True)
    restaurant_name = serializers.CharField(source='category.restaurant.name', read_only=True)
    store_type = serializers.CharField(source='category.restaurant.store_type', read_only=True)
    category_id = serializers.UUIDField(source='category.id', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'description', 'base_price', 'price',
            'image', 'pricing_unit', 'barcode', 'sku',
            'stock_quantity', 'is_stock_tracked', 'is_available', 'is_popular',
            'restaurant_id', 'restaurant_name', 'store_type',
            'category_id', 'category_name'
        ]

    def get_price(self, obj):
        return float(obj.base_price)

    def get_base_price(self, obj):
        return str(obj.base_price)

    def get_stock_quantity(self, obj):
        return float(obj.stock_quantity)

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        if request:
            url = request.build_absolute_uri(url)
        return _clean_image_url(url)
