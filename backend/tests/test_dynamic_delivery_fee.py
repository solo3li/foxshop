import pytest
from decimal import Decimal
from apps.restaurants.models import DeliveryZone, calculate_dynamic_delivery_fee
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip, DriverProfile

@pytest.fixture
def dynamic_delivery_zone(db, sar_currency):
    # Riyadh Zone with coordinates around 24.7136, 46.6753
    polygon_coords = [
        [24.7000, 46.6600],
        [24.7300, 46.6600],
        [24.7300, 46.6900],
        [24.7000, 46.6900],
        [24.7000, 46.6600]
    ]
    zone = DeliveryZone.objects.create(
        name='وسط الرياض',
        city='الرياض',
        currency=sar_currency,
        base_delivery_fee=Decimal('12.00'),
        base_distance_km=Decimal('3.00'),
        per_km_fee=Decimal('1.50'),
        max_delivery_fee=Decimal('30.00'),
        polygon_coordinates=polygon_coords,
        is_manual_surge_active=False,
        manual_surge_percent=Decimal('20.00'),
        is_auto_surge_enabled=False,
        auto_surge_percent=Decimal('25.00'),
        auto_surge_threshold_ratio=Decimal('2.00'),
        is_active=True
    )
    return zone

@pytest.mark.django_db
def test_base_distance_delivery_fee(restaurant, dynamic_delivery_zone):
    restaurant.delivery_zones.add(dynamic_delivery_zone)

    # Customer location close to restaurant (approx 1.5 km straight -> ~1.87 km driving, <= 3 km)
    cust_lat = 24.7200
    cust_lng = 46.6800

    fee_info = calculate_dynamic_delivery_fee(restaurant, cust_lat, cust_lng)
    assert fee_info['zone'] == dynamic_delivery_zone
    assert fee_info['delivery_fee'] == Decimal('12.00')
    assert fee_info['extra_km_fee'] == Decimal('0.00')
    assert fee_info['is_surge_applied'] is False

@pytest.mark.django_db
def test_tiered_distance_calculation(restaurant, dynamic_delivery_zone):
    restaurant.delivery_zones.add(dynamic_delivery_zone)

    # Customer location further away (approx 4.0 km straight -> 5.0 km driving)
    # Extra km = 5.0 - 3.0 = 2.0 km -> 2.0 * 1.50 = 3.00 SAR extra
    # Total = 12.00 + 3.00 = 15.00 SAR
    cust_lat = 24.7136
    # 0.04 degrees longitude at latitude 24 is ~4 km
    cust_lng = 46.7150

    fee_info = calculate_dynamic_delivery_fee(restaurant, cust_lat, cust_lng)
    assert fee_info['driving_distance_km'] > Decimal('3.00')
    assert fee_info['extra_km_fee'] > Decimal('0.00')
    expected_fee = fee_info['base_fee'] + fee_info['extra_km_fee']
    assert fee_info['delivery_fee'] == expected_fee

@pytest.mark.django_db
def test_manual_weather_surge(restaurant, dynamic_delivery_zone):
    dynamic_delivery_zone.is_manual_surge_active = True
    dynamic_delivery_zone.manual_surge_percent = Decimal('20.00')
    dynamic_delivery_zone.save()
    restaurant.delivery_zones.add(dynamic_delivery_zone)

    cust_lat = 24.7200
    cust_lng = 46.6800

    fee_info = calculate_dynamic_delivery_fee(restaurant, cust_lat, cust_lng)
    assert fee_info['is_surge_applied'] is True
    assert fee_info['surge_percent'] == Decimal('20.00')
    # Base fee is 12.00 * 1.20 = 14.40
    assert fee_info['delivery_fee'] == Decimal('14.40')

@pytest.mark.django_db
def test_auto_demand_surge(restaurant, dynamic_delivery_zone, driver_user, customer_user):
    dynamic_delivery_zone.is_auto_surge_enabled = True
    dynamic_delivery_zone.auto_surge_percent = Decimal('25.00')
    dynamic_delivery_zone.auto_surge_threshold_ratio = Decimal('2.00')
    dynamic_delivery_zone.save()
    restaurant.delivery_zones.add(dynamic_delivery_zone)

    # 1 online driver
    driver_user.driver_profile.is_online = True
    driver_user.driver_profile.is_busy = False
    driver_user.driver_profile.save()

    # Create 3 active orders in this zone (3 orders >= 1 driver * 2.0 ratio)
    for i in range(3):
        ord_obj = Order.objects.create(
            customer=customer_user,
            restaurant=restaurant,
            subtotal=50.00,
            delivery_fee=12.00,
            total_amount=62.00,
            delivery_zone=dynamic_delivery_zone,
            status=Order.Status.CONFIRMED
        )
        DeliveryTrip.objects.create(
            order=ord_obj,
            status=DeliveryTrip.Status.DISPATCHING
        )

    cust_lat = 24.7200
    cust_lng = 46.6800

    fee_info = calculate_dynamic_delivery_fee(restaurant, cust_lat, cust_lng)
    assert fee_info['is_surge_applied'] is True
    assert fee_info['surge_percent'] >= Decimal('25.00')
    # 12.00 * 1.25 = 15.00
    assert fee_info['delivery_fee'] == Decimal('15.00')

@pytest.mark.django_db
def test_max_delivery_fee_cap(restaurant, dynamic_delivery_zone):
    dynamic_delivery_zone.max_delivery_fee = Decimal('20.00')
    dynamic_delivery_zone.is_manual_surge_active = True
    dynamic_delivery_zone.manual_surge_percent = Decimal('50.00')
    dynamic_delivery_zone.per_km_fee = Decimal('5.00')
    dynamic_delivery_zone.save()
    restaurant.delivery_zones.add(dynamic_delivery_zone)

    # Far distance
    cust_lat = 24.8000
    cust_lng = 46.8000

    fee_info = calculate_dynamic_delivery_fee(restaurant, cust_lat, cust_lng)
    # The uncapped fee would exceed 20.00, but cap must enforce 20.00
    assert fee_info['delivery_fee'] == Decimal('20.00')

@pytest.mark.django_db
def test_order_checkout_applies_dynamic_delivery_fee(api_client, customer_user, restaurant, menu_item, customer_address, dynamic_delivery_zone):
    restaurant.delivery_zones.add(dynamic_delivery_zone)
    api_client.force_authenticate(user=customer_user)

    payload = {
        'restaurant_id': str(restaurant.id),
        'delivery_address_id': str(customer_address.id),
        'payment_method': 'COD',
        'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}]
    }

    res = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    assert res.status_code == 201
    
    order = Order.objects.get(id=res.data['id'])
    assert order.delivery_fee == Decimal('12.00')
    assert float(order.delivery_distance_km) > 0.0
    assert order.delivery_zone == dynamic_delivery_zone
    # Subtotal: 45 * 2 = 90.00 + 12.00 delivery fee = 102.00
    assert order.total_amount == Decimal('102.00')
