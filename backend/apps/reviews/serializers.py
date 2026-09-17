from rest_framework import serializers
from django.utils import timezone
from .models import OrderReview
from apps.orders.models import Order

class OrderReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderReview
        fields = [
            'food_rating', 'packaging_rating', 'restaurant_comment',
            'delivery_speed_rating', 'driver_rating', 'driver_comment'
        ]

    def validate(self, attrs):
        order_id = self.context.get('order_id')
        user = self.context['request'].user

        try:
            order = Order.objects.get(id=order_id, customer=user)
        except Order.DoesNotExist:
            raise serializers.ValidationError("الطلب غير موجود أو لا ينتمي لحسابك.")

        if order.status != Order.Status.DELIVERED:
            raise serializers.ValidationError("لا يمكن تقييم الطلب إلا بعد استلامه بنجاح.")

        if hasattr(order, 'review'):
            raise serializers.ValidationError("تم تقييم هذا الطلب مسبقاً.")

        attrs['order'] = order
        attrs['customer'] = user
        attrs['restaurant'] = order.restaurant
        if hasattr(order, 'delivery_trip') and order.delivery_trip.driver:
            attrs['driver'] = order.delivery_trip.driver

        return attrs

    def create(self, validated_data):
        return OrderReview.objects.create(**validated_data)


class OrderReviewDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.first_name', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)

    class Meta:
        model = OrderReview
        fields = [
            'id', 'order', 'customer_name', 'restaurant_name',
            'food_rating', 'packaging_rating', 'restaurant_comment',
            'delivery_speed_rating', 'driver_rating', 'driver_comment',
            'merchant_reply', 'merchant_replied_at', 'created_at'
        ]
        read_only_fields = ['id', 'order', 'customer_name', 'restaurant_name', 'merchant_reply', 'merchant_replied_at', 'created_at']


class MerchantReplySerializer(serializers.Serializer):
    reply = serializers.CharField(max_length=1000, required=True)

    def update(self, instance, validated_data):
        instance.merchant_reply = validated_data['reply']
        instance.merchant_replied_at = timezone.now()
        instance.save(update_fields=['merchant_reply', 'merchant_replied_at'])
        return instance
