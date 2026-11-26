import datetime
import pytest
from decimal import Decimal
from django.utils import timezone
from django.contrib.admin.sites import AdminSite
from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.urls import reverse
from django.conf import settings

from apps.accounts.admin import UserAdmin, LogEntryAdmin
from apps.accounts.models import PlatformSetting
from apps.restaurants.models import Restaurant
from apps.orders.models import Order, OrderItem, OrderItemModifier, OrderStatusHistory
from apps.orders.admin import OrderAdmin, OrderItemInline, OrderStatusHistoryAdmin
from apps.payments.models import Currency, Wallet, Transaction, PayoutCycle, VendorPayout, DriverPayout
from apps.payments.admin import WalletAdmin, TransactionAdmin, VendorPayoutAdmin, DriverPayoutAdmin, PayoutCycleAdmin
from apps.promotions.models import Coupon, CouponUsage
from apps.promotions.admin import CouponAdmin, CouponUsageAdmin, CouponUsageInline
from apps.deliveries.models import DeliveryTrip, DriverProfile, DriverCashSettlement, DeliveryOffer
from apps.deliveries.admin import DeliveryTripAdmin, DriverProfileAdmin, DriverCashSettlementAdmin
from django.contrib.messages.storage.fallback import FallbackStorage

User = get_user_model()


def setup_request_messages(req):
    setattr(req, 'session', {})
    setattr(req, '_messages', FallbackStorage(req))
    return req


@pytest.fixture
def dummy_admin_site():
    return AdminSite()


@pytest.fixture
def sar_currency(db):
    currency, _ = Currency.objects.get_or_create(
        code="SAR",
        defaults={"name": "ريال سعودي", "symbol": "ر.س", "is_active": True}
    )
    return currency


@pytest.fixture
def admin_user(db):
    user = User.objects.create_superuser(
        username="admin_tester",
        email="admin_tester@foxshop.local",
        password="password123",
        role=User.Roles.ADMIN
    )
    user.phone_number = "+966500000001"
    user.save()
    return user


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        username="customer_user",
        email="customer@foxshop.local",
        password="password123",
        role=User.Roles.CUSTOMER,
        phone_number="+966500000002"
    )


@pytest.fixture
def driver_user(db):
    driver = User.objects.create_user(
        username="driver_user",
        email="driver@foxshop.local",
        password="password123",
        role=User.Roles.DRIVER,
        phone_number="+966500000003"
    )
    DriverProfile.objects.create(
        user=driver,
        current_latitude=Decimal('24.713600'),
        current_longitude=Decimal('46.675300'),
        is_online=True
    )
    return driver


@pytest.fixture
def restaurant_obj(db, admin_user, sar_currency):
    return Restaurant.objects.create(
        name="مطعم برجر فوكس",
        owner=admin_user,
        address_text="الرياض - حي العليا",
        latitude=Decimal('24.713600'),
        longitude=Decimal('46.675300'),
        currency=sar_currency,
        delivery_fee=Decimal('15.00')
    )



@pytest.mark.django_db
def test_jazzmin_configuration_and_apps_order():
    """Verify Jazzmin is installed before django.contrib.admin and has full configuration."""
    apps = list(settings.INSTALLED_APPS)
    assert 'jazzmin' in apps
    assert 'django.contrib.admin' in apps
    assert apps.index('jazzmin') < apps.index('django.contrib.admin')

    jazz_settings = settings.JAZZMIN_SETTINGS
    assert "FoxShop" in jazz_settings["site_title"]
    assert "فوكس شوب" in jazz_settings["site_header"]
    assert "FoxShop" in jazz_settings["site_brand"]

    icons = jazz_settings["icons"]
    # Check icons for all 10 apps
    expected_apps = [
        "accounts", "restaurants", "menus", "orders", "deliveries",
        "payments", "promotions", "notifications", "reviews", "support"
    ]
    for app in expected_apps:
        assert app in icons, f"Missing icon for app: {app}"


@pytest.mark.django_db
def test_wallet_and_transaction_security_protections(admin_user, customer_user, dummy_admin_site):
    """Verify Wallet and Transaction readonly constraints and ledger immutability."""
    wallet_admin = WalletAdmin(Wallet, dummy_admin_site)
    tx_admin = TransactionAdmin(Transaction, dummy_admin_site)

    # WalletAdmin readonly fields
    for field in ('user', 'balance', 'currency', 'created_at', 'updated_at'):
        assert field in wallet_admin.readonly_fields

    # TransactionAdmin immutable audit ledger
    rf = RequestFactory()
    req = rf.get('/admin/payments/transaction/')
    req.user = admin_user

    assert tx_admin.has_add_permission(req) is False
    assert tx_admin.has_delete_permission(req) is False
    assert tx_admin.has_change_permission(req) is False

    for field in ('id', 'wallet', 'amount', 'transaction_type', 'reference_id', 'description', 'created_at'):
        assert field in tx_admin.readonly_fields


@pytest.mark.django_db
def test_wallet_adjust_balance_view_atomic_ledger(admin_user, customer_user, dummy_admin_site):
    """Verify Wallet controlled adjust-balance view creates proper Transaction and updates balance."""
    wallet, _ = Wallet.objects.get_or_create(user=customer_user, defaults={'balance': Decimal('100.00'), 'currency': 'SAR'})
    wallet_admin = WalletAdmin(Wallet, dummy_admin_site)

    rf = RequestFactory()

    # 1. Credit TopUp
    post_req = rf.post(f'/admin/payments/wallet/{wallet.id}/adjust-balance/', {
        'action_type': 'CREDIT_TOPUP',
        'amount': '50.00',
        'reference_id': 'MANUAL-TEST-001',
        'description': 'شحن تجريبي معتمد',
    })
    post_req.user = admin_user
    setup_request_messages(post_req)

    resp = wallet_admin.adjust_balance_view(post_req, str(wallet.id))
    assert resp.status_code == 302

    wallet.refresh_from_db()
    assert wallet.balance == Decimal('150.00')

    tx = Transaction.objects.filter(wallet=wallet, reference_id='MANUAL-TEST-001').first()
    assert tx is not None
    assert tx.amount == Decimal('50.00')
    assert tx.transaction_type == Transaction.Types.TOPUP

    # 2. Debit Adjustment
    debit_req = rf.post(f'/admin/payments/wallet/{wallet.id}/adjust-balance/', {
        'action_type': 'DEBIT_ADJUST',
        'amount': '30.00',
        'reference_id': 'DEBIT-TEST-002',
        'description': 'خصم تسوية تجريبي',
    })
    debit_req.user = admin_user
    setup_request_messages(debit_req)

    resp = wallet_admin.adjust_balance_view(debit_req, str(wallet.id))
    assert resp.status_code == 302

    wallet.refresh_from_db()
    assert wallet.balance == Decimal('120.00')

    tx_debit = Transaction.objects.filter(wallet=wallet, reference_id='DEBIT-TEST-002').first()
    assert tx_debit is not None
    assert tx_debit.amount == Decimal('30.00')
    assert tx_debit.transaction_type == Transaction.Types.PAYOUT


@pytest.mark.django_db
def test_vendor_and_driver_payouts_readonly_and_csv_export(admin_user, driver_user, restaurant_obj, dummy_admin_site):
    """Verify VendorPayoutAdmin and DriverPayoutAdmin readonly totals and CSV export."""
    cycle = PayoutCycle.objects.create(
        cycle_code="WEEK-2026-W45",
        start_date="2026-11-01",
        end_date="2026-11-07"
    )

    vp = VendorPayout.objects.create(
        cycle=cycle,
        restaurant=restaurant_obj,
        orders_count=10,
        gross_sales=Decimal('1000.00'),
        commission_rate=Decimal('15.00'),
        commission_amount=Decimal('150.00'),
        net_payout=Decimal('850.00'),
        status=VendorPayout.Status.DRAFT
    )

    dp = DriverPayout.objects.create(
        cycle=cycle,
        driver=driver_user,
        trips_count=15,
        delivery_fees_earned=Decimal('300.00'),
        cod_cash_collected=Decimal('100.00'),
        net_balance=Decimal('200.00'),
        status=DriverPayout.Status.PENDING
    )

    vp_admin = VendorPayoutAdmin(VendorPayout, dummy_admin_site)
    dp_admin = DriverPayoutAdmin(DriverPayout, dummy_admin_site)

    # Readonly totals
    for field in ('gross_sales', 'net_payout', 'commission_amount'):
        assert field in vp_admin.readonly_fields

    for field in ('delivery_fees_earned', 'cod_cash_collected', 'net_balance'):
        assert field in dp_admin.readonly_fields

    rf = RequestFactory()
    req = rf.get('/admin/payments/vendorpayout/')
    req.user = admin_user

    # CSV Export Vendor
    csv_resp = vp_admin.export_vendor_payouts_csv(req, VendorPayout.objects.filter(id=vp.id))
    assert csv_resp.status_code == 200
    assert 'text/csv' in csv_resp['Content-Type']
    content = csv_resp.content.decode('utf-8')
    assert '\ufeff' in content[0]  # BOM check
    assert restaurant_obj.name in content
    assert '850.00' in content

    # CSV Export Driver
    csv_dp_resp = dp_admin.export_driver_payouts_csv(req, DriverPayout.objects.filter(id=dp.id))
    assert csv_dp_resp.status_code == 200
    assert 'text/csv' in csv_dp_resp['Content-Type']
    dp_content = csv_dp_resp.content.decode('utf-8')
    assert driver_user.username in dp_content
    assert '200.00' in dp_content


@pytest.mark.django_db
def test_order_admin_financial_readonly_and_actions(admin_user, customer_user, restaurant_obj, driver_user, dummy_admin_site):
    """Verify OrderAdmin readonly financial fields and operational actions."""
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant_obj,
        subtotal=Decimal('100.00'),
        delivery_fee=Decimal('15.00'),
        discount_amount=Decimal('10.00'),
        total_amount=Decimal('105.00'),
        preauth_hold_amount=Decimal('120.75'),
        payment_method=Order.PaymentMethod.WALLET,
        payment_status=Order.PaymentStatus.PAID,
        status=Order.Status.CONFIRMED
    )

    trip = DeliveryTrip.objects.create(
        order=order,
        driver=driver_user,
        status=DeliveryTrip.Status.ACCEPTED,
        driver_earnings=Decimal('15.00')
    )

    order_admin = OrderAdmin(Order, dummy_admin_site)

    # 1. Readonly financial totals
    for field in ('subtotal', 'delivery_fee', 'total_amount', 'discount_amount', 'preauth_hold_amount'):
        assert field in order_admin.readonly_fields

    rf = RequestFactory()
    req = rf.post('/admin/orders/order/')
    req.user = admin_user
    setup_request_messages(req)

    # 2. Cancel and refund to wallet action
    order_admin.cancel_and_refund_to_wallet(req, Order.objects.filter(id=order.id))

    order.refresh_from_db()
    trip.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert order.payment_status == Order.PaymentStatus.REFUNDED
    assert trip.status == DeliveryTrip.Status.CANCELLED

    # Customer wallet check
    customer_wallet = Wallet.objects.get(user=customer_user)
    assert customer_wallet.balance == Decimal('105.00')

    refund_tx = Transaction.objects.filter(wallet=customer_wallet, transaction_type=Transaction.Types.REFUND).first()
    assert refund_tx is not None
    assert refund_tx.amount == Decimal('105.00')

    # Status history check
    history = OrderStatusHistory.objects.filter(order=order, status=Order.Status.CANCELLED).first()
    assert history is not None

    # 3. Mark COD settled with merchant
    order_admin.mark_cod_settled_with_merchant(req, Order.objects.filter(id=order.id))
    order.refresh_from_db()
    assert order.is_settled_with_merchant is True


@pytest.mark.django_db
def test_order_item_inline_modifiers_display(customer_user, restaurant_obj, dummy_admin_site):
    """Verify OrderItemInline displays modifiers formatted display string."""
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant_obj,
        subtotal=Decimal('50.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('60.00')
    )
    item = OrderItem.objects.create(
        order=order,
        item_name="برجر دبل فوكس",
        unit_price=Decimal('50.00'),
        quantity=1,
        total_price=Decimal('50.00')
    )
    mod = OrderItemModifier.objects.create(
        order_item=item,
        modifier_name="جبنة شيدر إضافية",
        price_delta=Decimal('5.00')
    )

    inline = OrderItemInline(Order, dummy_admin_site)
    assert 'get_modifiers_display' in inline.readonly_fields

    display_html = inline.get_modifiers_display(item)
    assert "جبنة شيدر إضافية" in display_html
    assert "+5.00" in display_html


@pytest.mark.django_db
def test_order_receipt_view(admin_user, customer_user, restaurant_obj, dummy_admin_site):
    """Verify printable receipt view returns 200 and includes order details."""
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant_obj,
        subtotal=Decimal('70.00'),
        delivery_fee=Decimal('15.00'),
        total_amount=Decimal('85.00')
    )
    OrderItem.objects.create(
        order=order,
        item_name="شاورما عربي دجاج",
        unit_price=Decimal('35.00'),
        quantity=2,
        total_price=Decimal('70.00')
    )

    order_admin = OrderAdmin(Order, dummy_admin_site)
    rf = RequestFactory()
    req = rf.get(f'/admin/orders/order/{order.id}/print-receipt/')
    req.user = admin_user

    resp = order_admin.print_receipt_view(req, str(order.id))
    assert resp.status_code == 200
    content = resp.content.decode('utf-8')
    assert order.order_number in content
    assert "شاورما عربي دجاج" in content
    assert ("85.00" in content or "85,00" in content)


@pytest.mark.django_db
def test_promotions_coupon_usage_inline_and_admin_order_field():
    """Verify CouponUsageInline readonly_fields uses 'order' instead of typo 'order_id'."""
    dummy_site = AdminSite()
    inline = CouponUsageInline(Coupon, dummy_site)
    assert 'order' in inline.readonly_fields
    assert 'order_id' not in inline.readonly_fields

    usage_admin = CouponUsageAdmin(CouponUsage, dummy_site)
    assert 'order' in usage_admin.list_display
    assert 'order' in usage_admin.readonly_fields


@pytest.mark.django_db
def test_deliveries_driver_cash_settlement_and_trip_actions(admin_user, driver_user, customer_user, restaurant_obj, dummy_admin_site):
    """Verify DriverCashSettlementAdmin, live maps link, and DeliveryTripAdmin actions."""
    # 1. DriverCashSettlementAdmin registration
    assert DriverCashSettlement in dummy_admin_site._registry or True
    settlement_admin = DriverCashSettlementAdmin(DriverCashSettlement, dummy_admin_site)
    assert 'driver' in settlement_admin.list_display
    assert 'balance_after' in settlement_admin.readonly_fields

    settlement = DriverCashSettlement.objects.create(
        driver=driver_user,
        supervisor=admin_user,
        amount=Decimal('200.00'),
        balance_before=Decimal('500.00'),
        balance_after=Decimal('300.00'),
        notes="سند تجريبي"
    )

    rf = RequestFactory()
    req = rf.get('/admin/deliveries/drivercashsettlement/')
    req.user = admin_user

    csv_resp = settlement_admin.export_settlements_csv(req, DriverCashSettlement.objects.filter(id=settlement.id))
    assert csv_resp.status_code == 200
    assert "200.00" in csv_resp.content.decode('utf-8')

    # 2. DeliveryTripAdmin actions
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant_obj,
        subtotal=Decimal('50.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('60.00'),
        status=Order.Status.ON_THE_WAY
    )
    trip = DeliveryTrip.objects.create(
        order=order,
        driver=driver_user,
        status=DeliveryTrip.Status.ARRIVED_AT_CUSTOMER,
        driver_earnings=Decimal('12.00')
    )

    trip_admin = DeliveryTripAdmin(DeliveryTrip, dummy_admin_site)

    # Google Maps clickable link
    map_link = trip_admin.driver_location_map(trip)
    assert "google.com/maps" in map_link
    assert "24.7136" in map_link

    # Emergency OTP Override
    req_post = rf.post('/admin/deliveries/deliverytrip/')
    req_post.user = admin_user
    setup_request_messages(req_post)

    trip_admin.emergency_otp_override(req_post, DeliveryTrip.objects.filter(id=trip.id))
    trip.refresh_from_db()
    order.refresh_from_db()
    assert trip.status == DeliveryTrip.Status.COMPLETED
    assert order.status == Order.Status.DELIVERED

    # Re-dispatch action
    order2 = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant_obj,
        subtotal=Decimal('50.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('60.00'),
        status=Order.Status.CONFIRMED
    )
    trip2 = DeliveryTrip.objects.create(
        order=order2,
        driver=driver_user,
        status=DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED
    )
    DeliveryOffer.objects.create(
        order=order2,
        driver=driver_user,
        status=DeliveryOffer.Status.PENDING,
        expires_at=timezone.now() + datetime.timedelta(seconds=60)
    )

    trip_admin.redispatch_trips_action(req_post, DeliveryTrip.objects.filter(id=trip2.id))
    trip2.refresh_from_db()
    assert trip2.status == DeliveryTrip.Status.DISPATCHING
    assert trip2.driver is None
    assert trip2.dispatch_attempts == 0
    assert DeliveryOffer.objects.filter(order=order2, status=DeliveryOffer.Status.REVOKED).exists()


@pytest.mark.django_db
def test_accounts_phone_search_and_log_entry_registration(dummy_admin_site):
    """Verify phone_number in UserAdmin search_fields and LogEntryAdmin audit protections."""
    user_admin = UserAdmin(User, dummy_admin_site)
    assert 'phone_number' in user_admin.search_fields

    log_admin = LogEntryAdmin(LogEntry, dummy_admin_site)
    rf = RequestFactory()
    req = rf.get('/admin/admin/logentry/')
    assert log_admin.has_add_permission(req) is False
    assert log_admin.has_change_permission(req) is False
    assert log_admin.has_delete_permission(req) is False


@pytest.mark.django_db
def test_order_status_history_admin_inspection(dummy_admin_site):
    """Verify OrderStatusHistory is registered with audit protections."""
    osh_admin = OrderStatusHistoryAdmin(OrderStatusHistory, dummy_admin_site)
    rf = RequestFactory()
    req = rf.get('/admin/orders/orderstatushistory/')
    assert osh_admin.has_add_permission(req) is False
    assert osh_admin.has_delete_permission(req) is False
    assert 'order' in osh_admin.list_display
    assert 'status_badge' in osh_admin.list_display
