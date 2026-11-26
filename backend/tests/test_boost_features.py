import pytest
from decimal import Decimal
from unittest.mock import patch
from rest_framework import status

from apps.accounts.models import User, Address, PlatformSetting
from apps.restaurants.models import Restaurant
from apps.menus.models import MenuCategory, MenuItem
from apps.orders.models import Order, OrderItem
from apps.deliveries.models import DriverProfile, DeliveryTrip, ShiftSettlement
from apps.payments.models import Wallet, Transaction


@pytest.mark.django_db
def test_multi_vertical_store_and_pricing_unit(api_client, merchant_user, sar_currency):
    """
    Test Multi-Vertical store_type choices and MenuItem pricing_unit, barcode, SKU, and stock tracking.
    """
    # 1. Create a Supermarket / Butchery store
    market = Restaurant.objects.create(
        owner=merchant_user,
        name='سوبرماركت التميمي',
        store_type=Restaurant.StoreType.SUPERMARKET,
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=15.00
    )
    assert market.store_type == Restaurant.StoreType.SUPERMARKET
    assert market.delivery_mode == Restaurant.DeliveryMode.STORE_OWN_FLEET

    cat = MenuCategory.objects.create(restaurant=market, name='اللحوم والدواجن الطازجة')

    # 2. Create weighted item (Meat by KG)
    item_kg = MenuItem.objects.create(
        category=cat,
        name='لحم خروف بلدي طازج',
        base_price=75.00,
        pricing_unit=MenuItem.PricingUnit.KG,
        barcode='6281001234567',
        sku='MEAT-LAMB-01',
        stock_quantity=45.50,
        is_stock_tracked=True
    )
    assert item_kg.pricing_unit == MenuItem.PricingUnit.KG
    assert item_kg.barcode == '6281001234567'
    assert item_kg.stock_quantity == 45.50
    assert item_kg.is_stock_tracked is True

    # 3. Test customer restaurant list filtering by store_type
    res = api_client.get(f'/api/v1/customer/restaurants/?store_type={Restaurant.StoreType.SUPERMARKET}')
    assert res.status_code == status.HTTP_200_OK
    assert any(r['id'] == str(market.id) for r in res.data)
    market_data = next(r for r in res.data if r['id'] == str(market.id))
    assert market_data['store_type'] == 'SUPERMARKET'
    assert market_data['delivery_mode'] == 'STORE_OWN_FLEET'


@pytest.mark.django_db
def test_order_creation_with_variable_weight_and_preauth_hold(api_client, customer_user, merchant_user, sar_currency, customer_address):
    """
    Test variable weight order creation and +15% pre-authorization hold on weighted items for Card payments.
    """
    api_client.force_authenticate(user=customer_user)

    store = Restaurant.objects.create(
        owner=merchant_user,
        name='خضار وفواكه النخيل',
        store_type=Restaurant.StoreType.BUTCHERY_VEG,
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=10.00
    )
    cat = MenuCategory.objects.create(restaurant=store, name='فواكه طازجة')
    apple_item = MenuItem.objects.create(
        category=cat,
        name='تفاح أحمر سكري',
        base_price=12.00, # 12 SAR / KG
        pricing_unit=MenuItem.PricingUnit.KG,
        is_available=True
    )

    # Customer orders 2.5 KG of apples using CARD
    # Estimated line total = 2.5 * 12.00 = 30.00 SAR
    # Pre-auth hold = +15% of 30.00 = 4.50 SAR
    # Total card hold = subtotal (30) + delivery (10) + hold (4.50) = 44.50 SAR
    payload = {
        'restaurant_id': str(store.id),
        'delivery_address_id': str(customer_address.id),
        'payment_method': Order.PaymentMethod.CARD,
        'items': [
            {
                'menu_item_id': str(apple_item.id),
                'quantity': 1,
                'requested_weight': 2.500
            }
        ]
    }
    response = api_client.post('/api/v1/customer/orders/create/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    order_data = response.data

    assert float(order_data['subtotal']) == 30.00
    assert float(order_data['preauth_hold_amount']) == 4.50
    assert float(order_data['total_amount']) == 44.50
    assert order_data['is_weight_confirmed'] is False

    order_obj = Order.objects.get(id=order_data['id'])
    line_item = order_obj.items.first()
    assert line_item.is_weighted is True
    assert float(line_item.requested_weight) == 2.500


@pytest.mark.django_db
def test_merchant_confirm_weights_and_recalculate_total(api_client, customer_user, merchant_user, sar_currency, customer_address):
    """
    Test merchant entering actual measured weight (InstaShop model):
    recalculates line item, subtotal, captures exact card total, and releases hold.
    """
    store = Restaurant.objects.create(
        owner=merchant_user,
        name='ملحمة الريف',
        store_type=Restaurant.StoreType.BUTCHERY_VEG,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=10.00
    )
    cat = MenuCategory.objects.create(restaurant=store, name='لحوم')
    steak = MenuItem.objects.create(
        category=cat,
        name='ستيك ريب آي',
        base_price=100.00, # 100 SAR / KG
        pricing_unit=MenuItem.PricingUnit.KG,
        is_available=True
    )

    # Order placed with 1.0 kg requested (Card payment with 15% preauth: subtotal=100, fee=10, hold=15, total=125)
    order = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.CARD,
        payment_status=Order.PaymentStatus.PENDING,
        currency='SAR',
        subtotal=100.00,
        delivery_fee=10.00,
        preauth_hold_amount=15.00,
        total_amount=125.00,
        is_weight_confirmed=False
    )
    item = OrderItem.objects.create(
        order=order,
        menu_item=steak,
        item_name=steak.name,
        unit_price=100.00,
        quantity=1,
        requested_weight=1.000,
        is_weighted=True,
        total_price=100.00
    )

    # Merchant weighs item: actual weight is 1.150 KG
    api_client.force_authenticate(user=merchant_user)
    payload = {
        'items': [
            {
                'item_id': str(item.id),
                'actual_weight': 1.150
            }
        ]
    }
    with patch('apps.orders.views.publish_centrifugo_event') as mock_centrifugo:
        res = api_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', payload, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert mock_centrifugo.called

    order.refresh_from_db()
    item.refresh_from_db()

    # Exact line item price = 1.150 * 100 = 115.00 SAR
    assert float(item.actual_weight) == 1.150
    assert float(item.total_price) == 115.00

    # New exact total = 115 (subtotal) + 10 (delivery fee) = 125.00 SAR
    assert float(order.subtotal) == 115.00
    assert float(order.total_amount) == 125.00
    assert order.is_weight_confirmed is True
    assert order.payment_status == Order.PaymentStatus.PAID


@pytest.mark.django_db
def test_hybrid_fleet_delivery_mode(api_client, merchant_user, sar_currency, customer_user, customer_address):
    """
    Test STORE_OWN_FLEET vs PLATFORM_MANAGED:
    STORE_OWN_FLEET skips platform auto-dispatching to keep order within store fleet.
    """
    store_own = Restaurant.objects.create(
        owner=merchant_user,
        name='برجر ستيشن - أسطول خاص',
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=10.00
    )
    order_own = Order.objects.create(
        customer=customer_user,
        restaurant=store_own,
        delivery_address=customer_address,
        subtotal=50.00,
        delivery_fee=10.00,
        total_amount=60.00,
        currency='SAR',
        status=Order.Status.CONFIRMED
    )

    api_client.force_authenticate(user=merchant_user)
    with patch('core.inngest_client.inngest_client.send_sync') as mock_inngest:
        # Move to PREPARING
        res = api_client.post(f'/api/v1/merchant/orders/{order_own.id}/status/', {'status': Order.Status.PREPARING})
        assert res.status_code == 200
        # Inngest auto-dispatch should NOT be called for STORE_OWN_FLEET!
        assert not mock_inngest.called

    # Now test PLATFORM_MANAGED
    store_platform = Restaurant.objects.create(
        owner=merchant_user,
        name='بيتزا بلاتفورم',
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=10.00
    )
    order_plat = Order.objects.create(
        customer=customer_user,
        restaurant=store_platform,
        delivery_address=customer_address,
        subtotal=50.00,
        delivery_fee=10.00,
        total_amount=60.00,
        currency='SAR',
        status=Order.Status.CONFIRMED
    )
    with patch('core.inngest_client.inngest_client.send_sync') as mock_inngest:
        res2 = api_client.post(f'/api/v1/merchant/orders/{order_plat.id}/status/', {'status': Order.Status.PREPARING})
        assert res2.status_code == 200
        # Inngest auto-dispatch SHOULD be called for PLATFORM_MANAGED!
        assert mock_inngest.called


@pytest.mark.django_db
def test_driver_to_merchant_end_of_shift_settlement_otp_flow(api_client, merchant_user, driver_user, customer_user, customer_address, sar_currency):
    """
    Test End-of-Shift Cash Settlement with OTP:
    1. Driver delivers 2 COD orders for merchant.
    2. Merchant initiates settlement, calculates 100% goods amount owed, and gets 6-digit OTP.
    3. Driver enters OTP to verify handover.
    4. Driver's cash_in_hand is cleared.
    5. Platform commission is deducted from merchant's wallet.
    6. Both parties notified.
    """
    PlatformSetting.objects.update_or_create(
        id=1,
        defaults={'platform_commission_percent': 15.00}
    )

    store = Restaurant.objects.create(
        owner=merchant_user,
        name='مطعم الشاورما الأصيل',
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=15.00
    )

    # 1. Driver delivers 2 COD orders
    # Order 1: subtotal 100 + fee 15 = 115 total
    o1 = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.COD,
        status=Order.Status.DELIVERED,
        subtotal=100.00,
        delivery_fee=15.00,
        total_amount=115.00,
        currency='SAR',
        is_settled_with_merchant=False
    )
    DeliveryTrip.objects.create(order=o1, driver=driver_user, status=DeliveryTrip.Status.COMPLETED)

    # Order 2: subtotal 80 + fee 15 = 95 total
    o2 = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.COD,
        status=Order.Status.DELIVERED,
        subtotal=80.00,
        delivery_fee=15.00,
        total_amount=95.00,
        currency='SAR',
        is_settled_with_merchant=False
    )
    DeliveryTrip.objects.create(order=o2, driver=driver_user, status=DeliveryTrip.Status.COMPLETED)

    # Driver collected cash for both orders = 115 + 95 = 210 SAR
    driver_profile = driver_user.driver_profile
    driver_profile.cash_in_hand = 210.00
    driver_profile.save()

    # Merchant has 100 SAR in wallet initially
    merchant_wallet, _ = Wallet.objects.get_or_create(user=merchant_user, defaults={'currency': 'SAR', 'balance': 100.00})
    merchant_wallet.balance = 100.00
    merchant_wallet.save()

    # 2. Merchant checks settlements list & unsettled drivers
    api_client.force_authenticate(user=merchant_user)
    list_res = api_client.get('/api/v1/merchant/settlements/')
    assert list_res.status_code == status.HTTP_200_OK
    unsettled = list_res.data['unsettled_drivers']
    assert len(unsettled) >= 1
    target_unsettled = next(d for d in unsettled if d['driver_id'] == str(driver_user.id))
    assert target_unsettled['orders_count'] == 2
    # 100% of merchandise value = 100 + 80 = 180 SAR
    assert float(target_unsettled['total_goods_amount']) == 180.00

    # 3. Merchant generates settlement OTP for driver
    create_res = api_client.post('/api/v1/merchant/settlements/create/', {'driver_id': str(driver_user.id)})
    assert create_res.status_code == status.HTTP_201_CREATED
    otp_code = create_res.data['otp_code']
    settlement_id = create_res.data['settlement']['id']
    assert len(otp_code) == 6
    assert float(create_res.data['settlement']['total_goods_amount']) == 180.00
    # Platform commission = 15% of 180 = 27.00 SAR
    assert float(create_res.data['settlement']['platform_commission_amount']) == 27.00

    # 4. Driver checks pending settlements
    api_client.force_authenticate(user=driver_user)
    driver_pending = api_client.get('/api/v1/driver/settlement/pending/')
    assert driver_pending.status_code == status.HTTP_200_OK
    assert driver_pending.data['count'] >= 1
    assert any(s['id'] == settlement_id for s in driver_pending.data['settlements'])

    # 5. Driver verifies OTP handed over by merchant
    with patch('apps.deliveries.views_settlement.publish_centrifugo_event') as mock_centrifugo:
        verify_res = api_client.post('/api/v1/driver/settlement/verify-otp/', {
            'settlement_id': settlement_id,
            'otp_code': otp_code
        })
        assert verify_res.status_code == status.HTTP_200_OK
        assert mock_centrifugo.called

    # 6. Verify financial updates
    driver_profile.refresh_from_db()
    # Driver cash in hand reduced by 180 SAR (from 210 to 30)
    assert float(driver_profile.cash_in_hand) == 30.00

    # Orders marked settled
    o1.refresh_from_db()
    o2.refresh_from_db()
    assert o1.is_settled_with_merchant is True
    assert o2.is_settled_with_merchant is True

    # Settlement completed
    settlement = ShiftSettlement.objects.get(id=settlement_id)
    assert settlement.status == ShiftSettlement.Status.COMPLETED
    assert settlement.settled_at is not None

    # Merchant wallet debited by 27 SAR platform commission (100 - 27 = 73 SAR)
    merchant_wallet.refresh_from_db()
    assert float(merchant_wallet.balance) == 73.00

    # Transaction record created
    tx = Transaction.objects.filter(wallet=merchant_wallet, reference_id=f"SETTLE-{str(settlement.id)[:8]}").first()
    assert tx is not None
    assert float(tx.amount) == -27.00


@pytest.mark.django_db
def test_variable_weight_validation_and_status_checks(api_client, customer_user, merchant_user, sar_currency, customer_address):
    """
    Test edge cases for variable weight:
    1. Zero and negative actual_weight must be rejected with 400 Bad Request.
    2. Confirming weights on DELIVERED or CANCELLED order must be rejected with 400 Bad Request.
    3. Placing a COD order with weighted items must NOT add pre-auth hold amount (preauth_hold_amount == 0).
    """
    store = Restaurant.objects.create(
        owner=merchant_user,
        name='ملحمة المروج',
        store_type=Restaurant.StoreType.BUTCHERY_VEG,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=10.00
    )
    cat = MenuCategory.objects.create(restaurant=store, name='لحوم')
    item_meat = MenuItem.objects.create(
        category=cat,
        name='كفتة غنم بلدي',
        base_price=60.00,
        pricing_unit=MenuItem.PricingUnit.KG,
        is_available=True
    )

    # 1. COD Order with weighted item: preauth_hold_amount MUST be 0.00
    api_client.force_authenticate(user=customer_user)
    cod_payload = {
        'restaurant_id': str(store.id),
        'delivery_address_id': str(customer_address.id),
        'payment_method': Order.PaymentMethod.COD,
        'items': [{'menu_item_id': str(item_meat.id), 'quantity': 1, 'requested_weight': 2.0}]
    }
    cod_res = api_client.post('/api/v1/customer/orders/create/', cod_payload, format='json')
    assert cod_res.status_code == status.HTTP_201_CREATED
    assert float(cod_res.data['preauth_hold_amount']) == 0.00
    assert float(cod_res.data['total_amount']) == 130.00 # 2.0 * 60 = 120 + 10 fee
    cod_order_id = cod_res.data['id']

    # 2. Test negative weight rejection
    api_client.force_authenticate(user=merchant_user)
    order_item = OrderItem.objects.filter(order_id=cod_order_id).first()
    neg_payload = {'items': [{'item_id': str(order_item.id), 'actual_weight': -1.5}]}
    neg_res = api_client.post(f'/api/v1/merchant/orders/{cod_order_id}/confirm-weights/', neg_payload, format='json')
    assert neg_res.status_code == status.HTTP_400_BAD_REQUEST
    assert 'يجب أن يكون الوزن الفعلي أكبر من صفر' in neg_res.data['error']

    # 3. Test zero weight rejection
    zero_payload = {'items': [{'item_id': str(order_item.id), 'actual_weight': 0.0}]}
    zero_res = api_client.post(f'/api/v1/merchant/orders/{cod_order_id}/confirm-weights/', zero_payload, format='json')
    assert zero_res.status_code == status.HTTP_400_BAD_REQUEST
    assert 'يجب أن يكون الوزن الفعلي أكبر من صفر' in zero_res.data['error']

    # 4. Test cannot modify weights on DELIVERED or CANCELLED order
    order_obj = Order.objects.get(id=cod_order_id)
    order_obj.status = Order.Status.DELIVERED
    order_obj.save()

    valid_payload = {'items': [{'item_id': str(order_item.id), 'actual_weight': 2.1}]}
    deliv_res = api_client.post(f'/api/v1/merchant/orders/{cod_order_id}/confirm-weights/', valid_payload, format='json')
    assert deliv_res.status_code == status.HTTP_400_BAD_REQUEST
    assert 'لا يمكن تعديل أوزان طلب مكتمل أو ملغي' in deliv_res.data['error']


@pytest.mark.django_db
def test_merchant_patch_store_settings(api_client, merchant_user, sar_currency):
    """
    Test merchant updating store_type and delivery_mode via PATCH /api/v1/merchant/restaurants/{id}/
    """
    api_client.force_authenticate(user=merchant_user)
    rest = Restaurant.objects.create(
        owner=merchant_user,
        name='صيدلية الشفاء',
        store_type=Restaurant.StoreType.RESTAURANT,
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=5.0,
        delivery_fee=8.00
    )

    patch_payload = {
        'store_type': Restaurant.StoreType.PHARMACY,
        'delivery_mode': Restaurant.DeliveryMode.STORE_OWN_FLEET
    }
    res = api_client.patch(f'/api/v1/merchant/restaurants/{rest.id}/', patch_payload, format='json')
    assert res.status_code == status.HTTP_200_OK
    assert res.data['store_type'] == 'PHARMACY'
    assert res.data['delivery_mode'] == 'STORE_OWN_FLEET'

    rest.refresh_from_db()
    assert rest.store_type == Restaurant.StoreType.PHARMACY
    assert rest.delivery_mode == Restaurant.DeliveryMode.STORE_OWN_FLEET


@pytest.mark.django_db
def test_store_own_fleet_full_lifecycle_and_commission(api_client, merchant_user, customer_user, sar_currency, customer_address):
    """
    Test STORE_OWN_FLEET order lifecycle:
    1. Merchant can move order through CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> ON_THE_WAY -> DELIVERED.
    2. Upon delivery, order is marked is_settled_with_merchant = True.
    3. Platform commission is automatically debited from merchant's wallet.
    """
    PlatformSetting.objects.update_or_create(id=1, defaults={'platform_commission_percent': 10.00})

    store = Restaurant.objects.create(
        owner=merchant_user,
        name='تموينات النرجس',
        store_type=Restaurant.StoreType.SUPERMARKET,
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=12.00
    )

    wallet, _ = Wallet.objects.get_or_create(user=merchant_user, defaults={'currency': 'SAR', 'balance': 50.00})
    wallet.balance = 50.00
    wallet.save()

    order = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.COD,
        subtotal=100.00,
        delivery_fee=12.00,
        total_amount=112.00,
        currency='SAR',
        status=Order.Status.CONFIRMED
    )

    api_client.force_authenticate(user=merchant_user)

    # Move to PREPARING
    r1 = api_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {'status': Order.Status.PREPARING})
    assert r1.status_code == 200

    # Move to READY_FOR_PICKUP
    r2 = api_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {'status': Order.Status.READY_FOR_PICKUP})
    assert r2.status_code == 200

    # Move to ON_THE_WAY (Own driver out for delivery)
    r3 = api_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {'status': Order.Status.ON_THE_WAY})
    assert r3.status_code == 200

    # Move to DELIVERED (Own driver delivered)
    r4 = api_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {'status': Order.Status.DELIVERED})
    assert r4.status_code == 200

    order.refresh_from_db()
    assert order.status == Order.Status.DELIVERED
    assert order.is_settled_with_merchant is True

    # 10% commission on 100 SAR subtotal = 10 SAR debited from wallet (50 - 10 = 40 SAR)
    wallet.refresh_from_db()
    assert float(wallet.balance) == 40.00

    tx = Transaction.objects.filter(wallet=wallet, reference_id=f"COMM-{str(order.id)[:8]}").first()
    assert tx is not None
    assert float(tx.amount) == -10.00


@pytest.mark.django_db
def test_shift_settlement_otp_expiration_and_regeneration(api_client, merchant_user, driver_user, customer_user, sar_currency, customer_address):
    """
    Test ShiftSettlement OTP expiration and regeneration:
    1. An OTP older than 2 hours is recognized as expired and rejected.
    2. Merchant can re-request settlement, generating a fresh OTP and resetting timestamp.
    3. Driver can verify with restaurant_id without passing settlement_id.
    """
    from datetime import timedelta
    from django.utils import timezone

    PlatformSetting.objects.update_or_create(id=1, defaults={'platform_commission_percent': 15.00})

    store = Restaurant.objects.create(
        owner=merchant_user,
        name='مطعم البركة',
        currency=sar_currency,
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=10.0,
        delivery_fee=10.00
    )

    order = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.COD,
        status=Order.Status.DELIVERED,
        subtotal=50.00,
        delivery_fee=10.00,
        total_amount=60.00,
        currency='SAR',
        is_settled_with_merchant=False
    )
    DeliveryTrip.objects.create(order=order, driver=driver_user, status=DeliveryTrip.Status.COMPLETED)

    driver_profile = driver_user.driver_profile
    driver_profile.cash_in_hand = 60.00
    driver_profile.save()

    # 1. Merchant creates settlement
    api_client.force_authenticate(user=merchant_user)
    c1 = api_client.post('/api/v1/merchant/settlements/create/', {'driver_id': str(driver_user.id)})
    assert c1.status_code == 201
    old_otp = c1.data['otp_code']
    settlement_id = c1.data['settlement']['id']

    # Simulate OTP expiring (> 2 hours ago)
    settlement = ShiftSettlement.objects.get(id=settlement_id)
    settlement.created_at = timezone.now() - timedelta(hours=3)
    settlement.save(update_fields=['created_at'])
    assert settlement.is_expired is True

    # 2. Driver attempts to verify expired OTP -> Rejected with 400
    api_client.force_authenticate(user=driver_user)
    v_expired = api_client.post('/api/v1/driver/settlement/verify-otp/', {
        'restaurant_id': str(store.id),
        'otp_code': old_otp
    })
    assert v_expired.status_code == status.HTTP_400_BAD_REQUEST
    assert 'انتهت صلاحية رمز التحقق' in v_expired.data['error']

    # 3. Merchant regenerates OTP
    api_client.force_authenticate(user=merchant_user)
    c2 = api_client.post('/api/v1/merchant/settlements/create/', {'driver_id': str(driver_user.id)})
    assert c2.status_code == 201
    new_otp = c2.data['otp_code']
    assert len(new_otp) == 6

    settlement.refresh_from_db()
    assert settlement.is_expired is False
    assert settlement.otp_code == new_otp

    # 4. Driver verifies using restaurant_id and new OTP -> Success!
    api_client.force_authenticate(user=driver_user)
    v_fresh = api_client.post('/api/v1/driver/settlement/verify-otp/', {
        'restaurant_id': str(store.id),
        'otp_code': new_otp
    })
    assert v_fresh.status_code == status.HTTP_200_OK
    assert v_fresh.data['settlement']['status'] == 'COMPLETED'
    assert float(v_fresh.data['remaining_cash_in_hand']) == 10.00 # 60 - 50 goods = 10 delivery fee remaining

