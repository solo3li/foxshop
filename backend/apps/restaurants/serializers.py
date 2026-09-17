from rest_framework import serializers
from .models import Restaurant, DeliveryZone, OperatingHours

class OperatingHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_display', read_only=True)

    class Meta:
        model = OperatingHours
        fields = ['day', 'day_name', 'opening_time', 'closing_time', 'is_closed']


class DeliveryZoneSerializer(serializers.ModelSerializer):
    polygon_coordinates = serializers.ReadOnlyField(source='coordinates_list')

    class Meta:
        model = DeliveryZone
        fields = ['id', 'name', 'city', 'currency', 'base_delivery_fee', 'polygon_coordinates', 'is_active']


class RestaurantListSerializer(serializers.ModelSerializer):
    distance_km = serializers.SerializerMethodField(required=False)

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'description', 'logo', 'cover_image',
            'rating', 'rating_count', 'delivery_fee', 'estimated_prep_time_minutes',
            'currency', 'is_busy', 'distance_km'
        ]

    def get_distance_km(self, obj):
        return getattr(obj, 'computed_distance', None)


class RestaurantDetailSerializer(serializers.ModelSerializer):
    operating_hours = OperatingHoursSerializer(many=True, read_only=True)
    delivery_zones = DeliveryZoneSerializer(many=True, read_only=True)

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'description', 'logo', 'cover_image',
            'address_text', 'latitude', 'longitude', 'delivery_radius_km',
            'currency', 'min_order_amount', 'delivery_fee', 'estimated_prep_time_minutes',
            'rating', 'rating_count', 'is_active', 'is_busy', 'operating_hours', 'delivery_zones'
        ]
        read_only_fields = ['id', 'slug', 'rating', 'rating_count']
