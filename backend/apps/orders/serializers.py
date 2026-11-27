from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from core.image_utils import build_imgproxy_url
from .models import Order, OrderItem, OrderItemModifier, OrderStatusHistory
from apps.restaurants.models import Restaurant
from apps.accounts.models import Address
from apps.menus.models import MenuItem, Modifier
from apps.accounts.serializers import AddressSerializer

class OrderItemModifierSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='modifier_name', read_only=True)

    class Meta:
        model = OrderItemModifier
        fields = ['id', 'name', 'modifier_name', 'price_delta']


class OrderItemSerializer(serializers.ModelSerializer):
    modifiers = OrderItemModifierSerializer(many=True, read_only=True)
    menu_item_name = serializers.CharField(source='item_name', read_only=True)
    pricing_unit = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'menu_item', 'item_name', 'menu_item_name', 'unit_price', 'quantity',
            'requested_weight', 'actual_weight', 'is_weighted', 'pricing_unit',
            'total_price', 'modifiers'
        ]

    def get_pricing_unit(self, obj):
        if obj.menu_item:
            return obj.menu_item.pricing_unit
        return 'KG' if obj.is_weighted else 'PIECE'


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
    restaurant_phone = serializers.CharField(source='restaurant.owner.phone_number', read_only=True, default='')
    restaurant_latitude = serializers.DecimalField(source='restaurant.latitude', max_digits=9, decimal_places=6, read_only=True)
    restaurant_longitude = serializers.DecimalField(source='restaurant.longitude', max_digits=9, decimal_places=6, read_only=True)
    restaurant_address = serializers.CharField(source='restaurant.address_text', read_only=True, default='')
    restaurant_delivery_mode = serializers.CharField(source='restaurant.delivery_mode', read_only=True)
    restaurant_store_type = serializers.CharField(source='restaurant.store_type', read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True, default='')
    delivery_info = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'restaurant', 'restaurant_name', 'restaurant_logo',
            'restaurant_phone', 'restaurant_latitude', 'restaurant_longitude', 'restaurant_address',
            'restaurant_delivery_mode', 'restaurant_store_type',
            'status', 'status_display', 'payment_method', 'payment_status', 'currency',
            'subtotal', 'delivery_fee', 'delivery_distance_km', 'is_surge_applied', 'surge_percent',
            'discount_amount', 'coupon_code', 'coupon_funded_by', 'preauth_hold_amount', 'total_amount',
            'is_weight_confirmed', 'is_settled_with_merchant',
            'prep_time_minutes', 'customer_notes', 'delivery_address_snapshot',
            'customer_name', 'customer_phone', 'delivery_info',
            'items', 'status_history', 'created_at'
        ]

    def get_customer_name(self, obj):
        if obj.customer:
            name = f"{obj.customer.first_name or ''} {obj.customer.last_name or ''}".strip()
            return name or obj.customer.username
        return "عميل"

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['restaurant_logo'] = build_imgproxy_url(
            ret.get('restaurant_logo'),
            request=self.context.get('request'),
            width=200,
            height=200,
            quality=75,
        )
        return ret

    def get_delivery_info(self, obj):
        if hasattr(obj, 'delivery_trip') and obj.delivery_trip:
            import json
            from apps.deliveries.services import get_redis_client
            trip = obj.delivery_trip
            driver = trip.driver
            driver_name = None
            driver_phone = None
            driver_lat = None
            driver_lng = None
            driver_heading = 0.0
            driver_speed = 0.0

            if driver:
                driver_name = f"{driver.first_name or ''} {driver.last_name or ''}".strip() or driver.username
                driver_phone = getattr(driver, 'phone_number', None)
                try:
                    r = get_redis_client()
                    if r:
                        pos_raw = r.get(f"driver:{driver.id}:pos")
                        if pos_raw:
                            pos = json.loads(pos_raw)
                            driver_lat = pos.get('latitude')
                            driver_lng = pos.get('longitude')
                            driver_heading = pos.get('heading', 0.0)
                            driver_speed = pos.get('speed', 0.0)
                except Exception:
                    pass

                if driver_lat is None and hasattr(driver, 'driver_profile'):
                    profile = driver.driver_profile
                    driver_lat = profile.current_latitude
                    driver_lng = profile.current_longitude

            return {
                'id': str(trip.id),
                'status': trip.status,
                'status_display': trip.get_status_display(),
                'driver_id': str(driver.id) if driver else None,
                'driver_name': driver_name,
                'driver_phone': driver_phone,
                'driver_latitude': driver_lat,
                'driver_longitude': driver_lng,
                'driver_heading': driver_heading,
                'driver_speed': driver_speed,
                'delivery_otp': trip.delivery_otp,
                'picked_up_at': trip.picked_up_at.isoformat() if trip.picked_up_at else None,
                'completed_at': trip.completed_at.isoformat() if trip.completed_at else None,
            }
        return None


class CreateOrderItemInputSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    requested_weight = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        min_value=Decimal('0.001'),
        required=False,
        allow_null=True,
        default=None,
    )
    modifier_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


class OrderCreateSerializer(serializers.Serializer):
    restaurant_id = serializers.UUIDField()
    delivery_address_id = serializers.UUIDField()
    payment_method = serializers.ChoiceField(choices=Order.PaymentMethod.choices, default=Order.PaymentMethod.COD)
    customer_notes = serializers.CharField(required=False, allow_blank=True, default="")
    coupon_code = serializers.CharField(required=False, allow_blank=True, default="")
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
            active_zones = restaurant.delivery_zones.filter(is_active=True)
            if active_zones.exists():
                raise serializers.ValidationError(f"عنوان التوصيل يقع خارج مناطق التوصيل المعتمدة لهذا المتجر ({restaurant.name})")
            else:
                raise serializers.ValidationError(f"عنوان التوصيل خارج نطاق تغطية المطعم ({round(dist, 1)} كم، الحد الأقصى: {restaurant.delivery_radius_km} كم)")

        # 3. Single-Vendor Cart & Item validation
        from decimal import Decimal
        subtotal = Decimal('0.00')
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

            # Check variable weight / pricing unit
            is_weighted = (menu_item.pricing_unit in [MenuItem.PricingUnit.KG, MenuItem.PricingUnit.GRAM, MenuItem.PricingUnit.LITER]) or (it.get('requested_weight') is not None)
            req_weight = None

            if is_weighted:
                raw_req_weight = it.get('requested_weight')
                req_weight = Decimal(str(raw_req_weight)) if raw_req_weight is not None else Decimal(str(it['quantity']))
                if not req_weight.is_finite() or req_weight <= Decimal('0.000'):
                    raise serializers.ValidationError("يجب أن يكون الوزن المطلوب أكبر من صفر")
                if menu_item.pricing_unit == MenuItem.PricingUnit.GRAM:
                    item_total = round((menu_item.base_price / Decimal('1000')) * req_weight, 2)
                else:
                    item_total = round(menu_item.base_price * req_weight, 2)
            else:
                item_total = round(menu_item.base_price * it['quantity'], 2)

            modifiers_list = []
            for mod_id in it.get('modifier_ids', []):
                try:
                    modifier = Modifier.objects.get(pk=mod_id, group__menu_item=menu_item, is_available=True)
                    modifiers_list.append(modifier)
                    item_total += modifier.price_delta * (it['quantity'] if not is_weighted else 1)
                except Modifier.DoesNotExist:
                    raise serializers.ValidationError(f"الخيار المضاف للصنف '{menu_item.name}' غير متوفر")

            if item_total < Decimal('0.00'):
                raise serializers.ValidationError(f"لا يمكن أن يكون إجمالي الصنف '{menu_item.name}' سالباً")

            subtotal += item_total
            validated_items.append({
                'menu_item': menu_item,
                'quantity': it['quantity'],
                'requested_weight': req_weight,
                'is_weighted': is_weighted,
                'unit_price': menu_item.base_price,
                'total_price': item_total,
                'modifiers': modifiers_list
            })

        if subtotal < restaurant.min_order_amount:
            raise serializers.ValidationError(f"الحد الأدنى للطلب من هذا المطعم هو {restaurant.min_order_amount} {restaurant.currency}")

        # Calculate dynamic delivery fee
        from apps.restaurants.models import calculate_dynamic_delivery_fee
        fee_info = calculate_dynamic_delivery_fee(restaurant, address.latitude, address.longitude)
        delivery_fee = fee_info['delivery_fee']

        # InstaShop Pre-authorization hold logic for variable weighted items:
        # +15% pre-auth hold on weighted items for card payments ONLY
        weighted_subtotal = sum(item['total_price'] for item in validated_items if item.get('is_weighted'))
        preauth_hold_amount = Decimal('0.00')
        if weighted_subtotal > 0 and data.get('payment_method') == Order.PaymentMethod.CARD:
            preauth_hold_amount = round(Decimal(str(weighted_subtotal)) * Decimal('0.15'), 2)

        # Coupon / Promotions Validation
        coupon_code = data.get('coupon_code', '').strip().upper()
        coupon_obj = None
        discount_amount = Decimal('0.00')
        if coupon_code:
            from apps.promotions.models import Coupon, CouponUsage
            from django.utils import timezone
            now = timezone.now()
            try:
                coupon_obj = Coupon.objects.get(code=coupon_code, is_active=True, valid_from__lte=now, valid_to__gte=now)
            except Coupon.DoesNotExist:
                raise serializers.ValidationError({"coupon_code": "كوبون الخصم غير صالح أو منتهي الصلاحية"})

            # Store specific validation
            if coupon_obj.restaurant_id and coupon_obj.restaurant_id != restaurant.id:
                store_title = coupon_obj.restaurant.name if coupon_obj.restaurant else "متجر آخر"
                raise serializers.ValidationError({"coupon_code": f"هذا الكوبون صالح فقط للطلب من {store_title}"})

            # Usage limit per user
            usage_count = CouponUsage.objects.filter(coupon=coupon_obj, user=user).count()
            if usage_count >= coupon_obj.max_usage_per_user:
                raise serializers.ValidationError({"coupon_code": "لقد استنفدت الحد الأقصى المسموح لاستخدام هذا الكوبون"})

            # First order only
            if coupon_obj.first_order_only:
                has_delivered = Order.objects.filter(customer=user, status=Order.Status.DELIVERED).exists()
                if has_delivered:
                    raise serializers.ValidationError({"coupon_code": "هذا الكوبون مخصص للعملاء الجدد وللطلب الأول فقط"})

            # Minimum order amount
            if subtotal < coupon_obj.min_order_amount:
                raise serializers.ValidationError({"coupon_code": f"الحد الأدنى لقيمة الطلب لتطبيق هذا الكوبون هو {coupon_obj.min_order_amount} {restaurant.currency}"})

            discount_amount = coupon_obj.calculate_discount(subtotal, delivery_fee)

        # Compute total after discount
        base_total = max(Decimal('0.00'), subtotal + delivery_fee - discount_amount)
        if data.get('payment_method') == Order.PaymentMethod.CARD:
            total_amount = base_total + preauth_hold_amount
        else:
            total_amount = base_total

        # F4: Enforce wallet balance check before order creation
        if data.get('payment_method') == Order.PaymentMethod.WALLET:
            from apps.payments.models import Wallet
            wallet = Wallet.objects.filter(user=user).first()
            if (
                wallet is None
                or Decimal(str(wallet.balance)) < Decimal('0.00')
                or Decimal(str(wallet.balance)) < total_amount
            ):
                raise serializers.ValidationError({"payment_method": "رصيد المحفظة غير كافٍ لإتمام الطلب"})

        data['restaurant_obj'] = restaurant
        data['address_obj'] = address
        data['subtotal'] = subtotal
        data['delivery_fee'] = delivery_fee
        data['discount_amount'] = discount_amount
        data['coupon_obj'] = coupon_obj
        data['preauth_hold_amount'] = preauth_hold_amount
        data['total_amount'] = total_amount
        data['fee_info'] = fee_info
        data['validated_items_data'] = validated_items
        return data

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        restaurant = validated_data['restaurant_obj']
        address = validated_data['address_obj']
        fee_info = validated_data.get('fee_info', {})
        coupon = validated_data.get('coupon_obj')
        payment_method = validated_data['payment_method']
        total_amount = validated_data['total_amount']

        payment_status = Order.PaymentStatus.PENDING
        locked_wallet = None

        # F5: Atomic wallet debit with row-level lock
        if payment_method == Order.PaymentMethod.WALLET:
            from apps.payments.models import Wallet, Transaction
            locked_wallet = Wallet.objects.select_for_update().filter(user=user).first()
            if (
                locked_wallet is None
                or Decimal(str(locked_wallet.balance)) < Decimal('0.00')
                or Decimal(str(locked_wallet.balance)) < total_amount
            ):
                raise serializers.ValidationError({"payment_method": "رصيد المحفظة غير كافٍ لإتمام الطلب"})
            if total_amount > Decimal('0.00'):
                locked_wallet.balance = Decimal(str(locked_wallet.balance)) - total_amount
                locked_wallet.save(update_fields=['balance', 'updated_at'])
            payment_status = Order.PaymentStatus.PAID

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
            payment_method=payment_method,
            payment_status=payment_status,
            currency=restaurant.currency_id,
            subtotal=validated_data['subtotal'],
            delivery_fee=validated_data['delivery_fee'],
            discount_amount=validated_data.get('discount_amount', Decimal('0.00')),
            coupon=coupon,
            coupon_code=coupon.code if coupon else '',
            coupon_funded_by=coupon.funded_by if coupon else '',
            preauth_hold_amount=validated_data.get('preauth_hold_amount', Decimal('0.00')),
            total_amount=total_amount,
            delivery_zone=fee_info.get('zone'),
            delivery_distance_km=fee_info.get('driving_distance_km', 0.00),
            is_surge_applied=fee_info.get('is_surge_applied', False),
            surge_percent=fee_info.get('surge_percent', 0.00),
            prep_time_minutes=restaurant.estimated_prep_time_minutes,
            customer_notes=validated_data.get('customer_notes', '')
        )

        # F5: Create Transaction ledger record for WALLET payment
        if payment_method == Order.PaymentMethod.WALLET and locked_wallet is not None and total_amount > Decimal('0.00'):
            from apps.payments.models import Transaction
            Transaction.objects.create(
                wallet=locked_wallet,
                amount=-order.total_amount,
                transaction_type=Transaction.Types.ORDER_PAYMENT,
                reference_id=f"ORD-{order.order_number}",
                description=f"دفع قيمة الطلب #{order.order_number}"
            )

        # Record CouponUsage if coupon was applied
        if coupon:
            from apps.promotions.models import CouponUsage
            CouponUsage.objects.create(
                coupon=coupon,
                user=user,
                order=order,
                discount_applied=validated_data.get('discount_amount', Decimal('0.00'))
            )

        # Create Items and Modifiers
        for item_data in validated_data['validated_items_data']:
            order_item = OrderItem.objects.create(
                order=order,
                menu_item=item_data['menu_item'],
                item_name=item_data['menu_item'].name,
                unit_price=item_data['unit_price'],
                quantity=item_data['quantity'],
                requested_weight=item_data.get('requested_weight'),
                actual_weight=item_data.get('requested_weight'),
                is_weighted=item_data.get('is_weighted', False),
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
            note="تم إنشاء الطلب بنجاح وهو بانتظار موافقة المتجر"
        )

        return order
