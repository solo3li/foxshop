from decimal import Decimal
import inngest
import pytest

from apps.accounts.models import User
from apps.orders.models import Order
from apps.payments.models import Wallet, Transaction
from apps.deliveries.models import ShiftSettlement, DriverCashSettlement
from apps.deliveries.services import update_driver_gps
from apps.notifications.services import publish_centrifugo_event
from core.inngest_client import inngest_client


@pytest.mark.django_db
def test_supervisor_user_and_auth_clients(
    supervisor_user,
    customer_user,
    merchant_user,
    driver_user,
    auth_customer_client,
    auth_merchant_client,
    auth_driver_client,
    auth_supervisor_client,
):
    """Smoke test: Verify supervisor user role and authenticated clients initialization."""
    # Check supervisor user properties
    assert supervisor_user.role == User.Roles.OPS_MANAGER
    assert supervisor_user.is_ops_manager is True
    assert supervisor_user.is_staff is True
    assert supervisor_user.phone_number.startswith('+966504')

    # Verify clients are initialized and have credentials
    assert auth_customer_client is not None
    assert auth_merchant_client is not None
    assert auth_driver_client is not None
    assert auth_supervisor_client is not None

    # Check Authorization header format
    auth_header = auth_customer_client._credentials.get('HTTP_AUTHORIZATION', '')
    assert auth_header.startswith('Bearer ')


@pytest.mark.django_db
def test_wallets_fixtures_and_validation(customer_wallet, zero_balance_wallet, driver_wallet):
    """Smoke test: Verify wallet fixtures, balances, and atomic ledger deductions."""
    # Pre-funded customer wallet
    assert customer_wallet.balance == Decimal('1000.00')
    assert customer_wallet.currency == 'EGP'

    # Zero-balance customer wallet
    assert zero_balance_wallet.balance == Decimal('0.00')

    # Driver wallet
    assert driver_wallet.balance == Decimal('500.00')

    # Test debiting wallet and recording transaction
    order_amount = Decimal('150.00')
    assert customer_wallet.balance >= order_amount

    customer_wallet.balance -= order_amount
    customer_wallet.save(update_fields=['balance'])

    tx = Transaction.objects.create(
        wallet=customer_wallet,
        amount=-order_amount,
        transaction_type=Transaction.Types.ORDER_PAYMENT,
        reference_id='SMOKE-TEST-001',
        description='دفع تجريبي لاختبار الهيكل'
    )

    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == Decimal('850.00')
    assert tx.id is not None
    assert tx.amount == Decimal('-150.00')


@pytest.mark.django_db
def test_weighted_menu_item_fixture(weighted_menu_item):
    """Smoke test: Verify weighted menu item properties and pricing units."""
    assert weighted_menu_item.is_weighted is True
    assert weighted_menu_item.pricing_unit == 'KG'
    assert weighted_menu_item.unit == 'KG'
    assert weighted_menu_item.price_per_unit == Decimal('120.00')
    assert weighted_menu_item.base_price == Decimal('120.00')
    assert weighted_menu_item.is_available is True


@pytest.mark.django_db
def test_mock_centrifugo_recording(mock_centrifugo):
    """Smoke test: Verify Centrifugo mock spy intercepts and records real-time events."""
    channel = "orders:order_test_smoke"
    event_type = "STATUS_CHANGED"
    payload = {"order_id": "test-uuid-123", "status": "CONFIRMED"}

    # Publish an event through the service
    result = publish_centrifugo_event(channel=channel, event_type=event_type, data=payload)
    assert result is True

    # Assert recorded by spy
    assert len(mock_centrifugo.events) == 1
    ev = mock_centrifugo.events[0]
    assert ev.channel == channel
    assert ev.event_type == event_type
    assert ev.payload == payload
    assert ev['order_id'] == 'test-uuid-123'
    assert ev['status'] == 'CONFIRMED'

    # Test spy helper methods
    assert mock_centrifugo.has_event(channel=channel, event_type=event_type) is True
    assert mock_centrifugo.has_event(channel="non_existent") is False
    mock_centrifugo.assert_published(channel=channel, event_type=event_type, count=1)

    # Test clear
    mock_centrifugo.clear()
    assert len(mock_centrifugo.events) == 0


@pytest.mark.django_db
def test_mock_inngest_recording(mock_inngest):
    """Smoke test: Verify Inngest mock spy intercepts and records workflow events."""
    event_name = "order/prep.scheduled"
    event_data = {"order_id": "order-smoke-456", "prep_minutes": 20}

    # Send an event through inngest_client
    inngest_client.send_sync(
        inngest.Event(name=event_name, data=event_data)
    )

    # Assert recorded by spy
    assert len(mock_inngest.events) == 1
    ev = mock_inngest.events[0]
    assert ev.name == event_name
    assert ev.data == event_data
    assert ev.data['order_id'] == "order-smoke-456"

    # Test helper methods
    assert mock_inngest.has_event(name=event_name) is True
    assert mock_inngest.has_event(name="non_existent") is False
    mock_inngest.assert_sent(name=event_name, count=1)

    # Test clear
    mock_inngest.clear()
    assert len(mock_inngest.events) == 0


@pytest.mark.django_db
def test_mock_redis_geo_recording(mock_redis_geo, driver_user):
    """Smoke test: Verify Redis GEO mock intercepts GPS coordinates and pos cache."""
    lat = 24.713600
    lon = 46.675300

    # Call driver GPS update service
    update_driver_gps(driver_user, latitude=lat, longitude=lon, heading=90.0, speed=25.0)

    # Assert coords recorded in Redis GEO
    coords = mock_redis_geo.get_driver_coords(driver_user.id)
    assert coords is not None
    assert coords == (lon, lat)

    # Assert position JSON cache
    cache = mock_redis_geo.get_driver_pos_cache(driver_user.id)
    assert cache is not None
    assert cache['latitude'] == lat
    assert cache['longitude'] == lon
    assert cache['speed'] == 25.0


@pytest.mark.django_db
def test_order_factory_and_shift_settlement_factory(
    order_factory,
    shift_settlement_factory,
    weighted_menu_item,
    restaurant,
    customer_user,
    driver_user,
    supervisor_user,
):
    """Smoke test: Verify order and settlement factories across statuses and payment types."""
    # 1. Standard WALLET order
    order_wallet = order_factory(
        status=Order.Status.PENDING,
        payment_method=Order.PaymentMethod.WALLET
    )
    assert order_wallet.status == Order.Status.PENDING
    assert order_wallet.payment_method == Order.PaymentMethod.WALLET
    assert order_wallet.payment_status == Order.PaymentStatus.PAID
    assert order_wallet.items.count() > 0

    # 2. Weighted CARD order with 15% preauth hold
    order_card_weighted = order_factory(
        status=Order.Status.CONFIRMED,
        payment_method=Order.PaymentMethod.CARD,
        items=[{
            'menu_item': weighted_menu_item,
            'quantity': 1,
            'unit_price': weighted_menu_item.base_price,
            'is_weighted': True,
            'requested_weight': Decimal('2.000'),
        }],
        delivery_fee=Decimal('20.00'),
    )
    # 2.0 KG * 120.00 = 240.00 subtotal
    # 15% hold = 36.00
    # total = 240.00 + 20.00 + 36.00 = 296.00
    assert order_card_weighted.subtotal == Decimal('240.00')
    assert order_card_weighted.preauth_hold_amount == Decimal('36.00')
    assert order_card_weighted.total_amount == Decimal('296.00')

    # 3. Shift settlement linked to delivered orders
    settlement = shift_settlement_factory(
        restaurant_instance=restaurant,
        driver=driver_user,
        orders=[order_wallet],
        total_goods_amount=Decimal('450.00'),
        platform_commission_amount=Decimal('67.50'),
        status=ShiftSettlement.Status.PENDING,
    )
    assert settlement.restaurant == restaurant
    assert settlement.driver == driver_user
    assert settlement.orders_count == 1
    assert settlement.total_goods_amount == Decimal('450.00')
    assert settlement.otp_code is not None

    # 4. Supervisor cash settlement
    cash_settlement = shift_settlement_factory.create_cash_settlement(
        driver=driver_user,
        supervisor=supervisor_user,
        amount=Decimal('250.00'),
        status=DriverCashSettlement.Status.APPROVED,
    )
    assert cash_settlement.driver == driver_user
    assert cash_settlement.supervisor == supervisor_user
    assert cash_settlement.amount == Decimal('250.00')
    assert cash_settlement.status == DriverCashSettlement.Status.APPROVED
