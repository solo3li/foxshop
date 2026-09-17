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
    restaurant_name = serializers.CharField(source='order.restaurant.name', read_only=True)
    restaurant_address = serializers.CharField(source='order.restaurant.address_text', read_only=True)
    restaurant_latitude = serializers.DecimalField(source='order.restaurant.latitude', max_digits=9, decimal_places=6, read_only=True)
    restaurant_longitude = serializers.DecimalField(source='order.restaurant.longitude', max_digits=9, decimal_places=6, read_only=True)
    customer_name = serializers.CharField(source='order.customer.first_name', read_only=True)
    customer_phone = serializers.CharField(source='order.customer.phone_number', read_only=True)
    delivery_address = serializers.JSONField(source='order.delivery_address_snapshot', read_only=True)
    order_total = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    payment_method = serializers.CharField(source='order.payment_method', read_only=True)

    class Meta:
        model = DeliveryTrip
        fields = [
            'id', 'order', 'order_number', 'status', 'distance_km', 'driver_earnings',
            'restaurant_name', 'restaurant_address', 'restaurant_latitude', 'restaurant_longitude',
            'customer_name', 'customer_phone', 'delivery_address', 'order_total', 'payment_method',
            'offered_at', 'accepted_at', 'picked_up_at', 'completed_at'
        ]


class UpdateGPSInputSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)


class VerifyOTPInputSerializer(serializers.Serializer):
    otp = serializers.CharField(max_length=6)
