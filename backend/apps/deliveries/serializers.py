from rest_framework import serializers
from .models import DriverProfile, DeliveryTrip

class DriverProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)

    class Meta:
        model = DriverProfile
        fields = [
            'id', 'username', 'phone_number', 'vehicle_type', 'license_plate',
            'is_online', 'is_busy', 'current_latitude', 'current_longitude',
            'total_delivered_orders', 'rating', 'cash_in_hand'
        ]
        read_only_fields = ['id', 'total_delivered_orders', 'rating', 'cash_in_hand']


class DeliveryTripDetailSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    # Nested objects matching frontend DeliveryTrip TypeScript interface
    restaurant = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    delivery_address = serializers.SerializerMethodField()
    customer_notes = serializers.CharField(source='order.customer_notes', read_only=True, default='')
    total_amount = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    cash_to_collect = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    payment_method = serializers.CharField(source='order.payment_method', read_only=True)
    delivery_otp = serializers.CharField(read_only=True)
    items = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryTrip
        fields = [
            'id', 'order_number', 'status', 'status_display', 'distance_km', 'driver_earnings',
            'restaurant', 'customer', 'delivery_address',
            'customer_notes', 'total_amount', 'cash_to_collect', 'payment_method',
            'delivery_otp', 'items',
            'offered_at', 'accepted_at', 'picked_up_at', 'completed_at'
        ]

    def get_restaurant(self, obj):
        if not obj.order or not obj.order.restaurant:
            return None
        r = obj.order.restaurant
        return {
            'id': str(r.id),
            'name': r.name,
            'phone_number': getattr(r, 'phone', '') or '',
            'address_text': getattr(r, 'address_text', '') or '',
            'latitude': float(r.latitude) if r.latitude else None,
            'longitude': float(r.longitude) if r.longitude else None,
        }

    def get_customer(self, obj):
        if not obj.order or not obj.order.customer:
            return None
        c = obj.order.customer
        return {
            'first_name': c.first_name or '',
            'last_name': c.last_name or '',
            'phone_number': getattr(c, 'phone_number', '') or '',
        }

    def get_delivery_address(self, obj):
        if not obj.order:
            return None
        snap = dict(obj.order.delivery_address_snapshot or {})
        if (not snap.get('latitude') or not snap.get('longitude')) and obj.order.delivery_address:
            addr = obj.order.delivery_address
            if addr.latitude and not snap.get('latitude'):
                snap['latitude'] = float(addr.latitude)
            if addr.longitude and not snap.get('longitude'):
                snap['longitude'] = float(addr.longitude)
            if not snap.get('street') and addr.street:
                snap['street'] = addr.street
            if not snap.get('building_number') and addr.building_number:
                snap['building_number'] = addr.building_number
            if not snap.get('floor') and addr.floor:
                snap['floor'] = addr.floor
            if not snap.get('apartment_number') and addr.apartment_number:
                snap['apartment_number'] = addr.apartment_number
        return snap

    def get_items(self, obj):
        if not obj.order:
            return []
        return [
            {
                'id': str(item.id),
                'name': item.item_name,
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'total_price': str(item.total_price),
                'modifiers': [{'name': m.modifier_name} for m in item.modifiers.all()]
            }
            for item in obj.order.items.prefetch_related('modifiers').all()
        ]


class UpdateGPSInputSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(min_value=-180.0, max_value=180.0)

    def validate_latitude(self, value):
        return round(float(value), 6)

    def validate_longitude(self, value):
        return round(float(value), 6)


class VerifyOTPInputSerializer(serializers.Serializer):
    otp = serializers.CharField(max_length=6)
