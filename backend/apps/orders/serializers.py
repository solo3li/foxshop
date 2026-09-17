from rest_framework import serializers
from django.db import transaction
from .models import Order, OrderItem, OrderItemModifier, OrderStatusHistory
from apps.restaurants.models import Restaurant
from apps.accounts.models import Address
from apps.menus.models import MenuItem, Modifier
from apps.accounts.serializers import AddressSerializer

class OrderItemModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemModifier
        fields = ['id', 'modifier_name', 'price_delta']


class OrderItemSerializer(serializers.ModelSerializer):
    modifiers = OrderItemModifierSerializer(many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'item_name', 'unit_price', 'quantity', 'total_price', 'modifiers']


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ['id', 'status', 'note', 'created_at']


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    restaurant_logo = serializers.ImageField(source='restaurant.logo', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'restaurant', 'restaurant_name', 'restaurant_logo',
            'status', 'status_display', 'payment_method', 'payment_status', 'currency',
            'subtotal', 'delivery_fee', 'discount_amount', 'total_amount',
            'prep_time_minutes', 'customer_notes', 'delivery_address_snapshot',
            'items', 'status_history', 'created_at'
        ]


class CreateOrderItemInputSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    modifier_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


class OrderCreateSerializer(serializers.Serializer):
    restaurant_id = serializers.UUIDField()
    delivery_address_id = serializers.UUIDField()
    payment_method = serializers.ChoiceField(choices=Order.PaymentMethod.choices, default=Order.PaymentMethod.COD)
    customer_notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = CreateOrderItemInputSerializer(many=True)

    def validate(self, data):
        # 1. Verify restaurant
        try:
            restaurant = Restaurant.objects.get(pk=data['restaurant_id'], is_active=True)
        except Restaurant.DoesNotExist:
            raise serializers.ValidationError("المطعم المحدد غير متاح حالياً للطلب")

        # 2. Verify address & delivery distance
        user = self.context['request'].user
        try:
            address = Address.objects.get(pk=data['delivery_address_id'], user=user)
        except Address.DoesNotExist:
            raise serializers.ValidationError("عنوان التوصيل غير موجود أو لا ينتمي لهذا الحساب")

        in_range, dist = restaurant.is_within_delivery_range(address.latitude, address.longitude)
        if not in_range:
            raise serializers.ValidationError(f"عنوان التوصيل خارج نطاق تغطية المطعم ({round(dist, 1)} كم، الحد الأقصى: {restaurant.delivery_radius_km} كم)")

        # 3. Single-Vendor Cart & Item validation
        subtotal = 0
        validated_items = []
        for it in data['items']:
            try:
                menu_item = MenuItem.objects.get(pk=it['menu_item_id'])
            except MenuItem.DoesNotExist:
                raise serializers.ValidationError(f"الصنف ذو المعرف {it['menu_item_id']} غير موجود")

            if menu_item.category.restaurant_id != restaurant.id:
                raise serializers.ValidationError(f"لا يمكن طلب وجبات من مطاعم مختلفة في نفس السلة! الصنف '{menu_item.name}' يتبع مطعم آخر.")

            if not menu_item.is_available:
                raise serializers.ValidationError(f"عذراً، الصنف '{menu_item.name}' غير متوفر للطلب حالياً (نفدت الكمية)")

            item_total = menu_item.base_price * it['quantity']
            modifiers_list = []
            for mod_id in it.get('modifier_ids', []):
                try:
                    modifier = Modifier.objects.get(pk=mod_id, group__menu_item=menu_item, is_available=True)
                    modifiers_list.append(modifier)
                    item_total += modifier.price_delta * it['quantity']
                except Modifier.DoesNotExist:
                    raise serializers.ValidationError(f"الخيار المضاف للصنف '{menu_item.name}' غير متوفر")

            subtotal += item_total
            validated_items.append({
                'menu_item': menu_item,
                'quantity': it['quantity'],
                'unit_price': menu_item.base_price,
                'total_price': item_total,
                'modifiers': modifiers_list
            })

        if subtotal < restaurant.min_order_amount:
            raise serializers.ValidationError(f"الحد الأدنى للطلب من هذا المطعم هو {restaurant.min_order_amount} {restaurant.currency}")

        delivery_fee = restaurant.delivery_fee
        total_amount = subtotal + delivery_fee

        data['restaurant_obj'] = restaurant
        data['address_obj'] = address
        data['subtotal'] = subtotal
        data['delivery_fee'] = delivery_fee
        data['total_amount'] = total_amount
        data['validated_items_data'] = validated_items
        return data

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        restaurant = validated_data['restaurant_obj']
        address = validated_data['address_obj']

        address_snapshot = {
            'title': address.title,
            'street': address.street,
            'building_number': address.building_number,
            'floor': address.floor,
            'apartment_number': address.apartment_number,
            'delivery_instructions': address.delivery_instructions,
            'latitude': str(address.latitude),
            'longitude': str(address.longitude),
        }

        order = Order.objects.create(
            customer=user,
            restaurant=restaurant,
            delivery_address=address,
            delivery_address_snapshot=address_snapshot,
            payment_method=validated_data['payment_method'],
            currency=restaurant.currency_id,
            subtotal=validated_data['subtotal'],
            delivery_fee=validated_data['delivery_fee'],
            total_amount=validated_data['total_amount'],
            prep_time_minutes=restaurant.estimated_prep_time_minutes,
            customer_notes=validated_data.get('customer_notes', '')
        )

        # Create Items and Modifiers
        for item_data in validated_data['validated_items_data']:
            order_item = OrderItem.objects.create(
                order=order,
                menu_item=item_data['menu_item'],
                item_name=item_data['menu_item'].name,
                unit_price=item_data['unit_price'],
                quantity=item_data['quantity'],
                total_price=item_data['total_price']
            )
            for mod in item_data['modifiers']:
                OrderItemModifier.objects.create(
                    order_item=order_item,
                    modifier=mod,
                    modifier_name=mod.name,
                    price_delta=mod.price_delta
                )

        # Initial Status History
        OrderStatusHistory.objects.create(
            order=order,
            status=Order.Status.PENDING,
            note="تم إنشاء الطلب بنجاح وهو بانتظار موافقة المطعم"
        )

        return order
