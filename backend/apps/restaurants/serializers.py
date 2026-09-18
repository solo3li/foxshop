from rest_framework import serializers
from .models import Restaurant, DeliveryZone, OperatingHours, calculate_dynamic_delivery_fee

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

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'description', 'logo', 'cover_image',
            'address_text', 'latitude', 'longitude', 'delivery_radius_km',
            'currency', 'min_order_amount', 'delivery_fee', 'estimated_prep_time_minutes',
            'rating', 'rating_count', 'is_active', 'is_busy', 'operating_hours', 'delivery_zones'
        ]
        read_only_fields = ['id', 'slug', 'rating', 'rating_count']

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
