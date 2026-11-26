"""
Tier 4: Real-World Application Scenarios E2E Tests
===================================================
Comprehensive multi-step, multi-role end-to-end user journeys exercising
realistic FoxShop production workflows across Customer, Merchant, Driver,
Supervisor, Ops Manager, Inngest, Centrifugo, Redis GEO, and Meilisearch.

Authoritative Specifications:
- ORIGINAL_REQUEST.md (R1–R5)
- PROJECT.md (Architecture, Interface Contracts & Milestones M1–M5)
- TEST_INFRA.md (Scenarios S1–S5 & Coverage Thresholds >= 15 Scenarios)
"""

import datetime
import types
import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Address, PlatformSetting, User
from apps.deliveries.dispatch import accept_delivery_offer, reject_delivery_offer
from apps.deliveries.inngest_functions import (
    fn_driver_offer_timeout_handler,
    fn_order_auto_dispatch_flow,
    fn_weekly_vendor_payouts_cron,
)
from apps.deliveries.models import (
    DeliveryOffer,
    DeliveryTrip,
    DriverCashSettlement,
    DriverProfile,
    ShiftSettlement,
    SupervisorActionLog,
)
from apps.menus.models import MenuCategory, MenuItem, Modifier, ModifierGroup
from apps.orders.models import Order
from apps.payments.models import DriverPayout, Transaction, VendorPayout, Wallet
from apps.promotions.models import Coupon, CouponUsage
from apps.restaurants.models import DeliveryZone as StoreDeliveryZone, Restaurant


# ============================================================================
# Scenario Test Helpers
# ============================================================================

MINIMAL_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00"
    b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


class _StepRunner:
    def __init__(self, on_sleep=None):
        self.sleeps = []
        self.on_sleep = on_sleep

    def sleep(self, step_id, duration):
        self.sleeps.append((step_id, duration))
        if self.on_sleep:
            self.on_sleep(step_id, duration)

    def run(self, step_id, fn, *args, **kwargs):
        return fn(*args, **kwargs)


class _InngestCtx:
    def __init__(self, event_name, data, on_sleep=None):
        self.event = types.SimpleNamespace(name=event_name, data=data)
        self.step = _StepRunner(on_sleep=on_sleep)


def _invoke_inngest(fn_obj, event_name, data, on_sleep=None):
    ctx = _InngestCtx(event_name=event_name, data=data, on_sleep=on_sleep)
    handler = getattr(fn_obj, "_handler", None) or getattr(fn_obj, "fn", None) or fn_obj
    return handler(ctx)


def _jwt_client_for(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client, refresh


def _make_driver(prefix, lat=24.7136, lon=46.6753, cash_in_hand=Decimal("0.00"), is_online=True):
    uid = uuid.uuid4().hex[:6]
    user = User.objects.create_user(
        username=f"{prefix}_{uid}",
        password="Password123!",
        first_name="كابتن",
        last_name=uid,
        phone_number=f"+96656{uid[:7]}",
        role=User.Roles.DRIVER,
        is_active=True,
    )
    DriverProfile.objects.create(
        user=user,
        vehicle_type="MOTORCYCLE",
        is_online=is_online,
        is_busy=False,
        current_latitude=Decimal(str(lat)),
        current_longitude=Decimal(str(lon)),
        cash_in_hand=cash_in_hand,
    )
    return user


def _make_pod_photo(name="doorstep_pod.png"):
    return SimpleUploadedFile(name, MINIMAL_PNG_BYTES, content_type="image/png")


# ============================================================================
# S1–S5: Authoritative Core Real-World Scenarios (TEST_INFRA.md)
# ============================================================================


@pytest.mark.django_db
def test_s01_standard_supermarket_order_full_lifecycle(
    api_client,
    merchant_user,
    auth_merchant_client,
    egp_currency,
    mock_centrifugo,
    mock_inngest,
    mock_redis_geo,
):
    """
    S1: Standard Supermarket Order Flow
    Registration (role forced CUSTOMER) -> JWT refresh -> Wallet top-up within limits ->
    Catalog search (with Meilisearch DB fallback) -> Store listing -> Cart & WALLET checkout ->
    Atomic debit & ledger -> Collision-free order_number -> Inngest dispatch ->
    Driver GPS Redis GEOADD -> Concurrent offer race -> Contactless POD -> DELIVERED.
    """
    uid = uuid.uuid4().hex[:6]

    # 1. Setup supermarket store & items
    market = Restaurant.objects.create(
        owner=merchant_user,
        name="سوبرماركت النور فوكس",
        store_type=Restaurant.StoreType.SUPERMARKET,
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
        delivery_radius_km=15.0,
        min_order_amount=Decimal("20.00"),
        delivery_fee=Decimal("15.00"),
        estimated_prep_time_minutes=15,
        is_active=True,
    )
    cat = MenuCategory.objects.create(restaurant=market, name="مخبوزات وألبان")
    milk = MenuItem.objects.create(category=cat, name="حليب كامل الدسم", base_price=Decimal("35.00"), is_available=True)
    bread = MenuItem.objects.create(category=cat, name="خبز توست طازج", base_price=Decimal("25.00"), is_available=True)

    # 2. Public registration (attempts ADMIN escalation -> forced CUSTOMER)
    reg_res = api_client.post(
        "/api/v1/auth/register/",
        {
            "username": f"s1_cust_{uid}",
            "password": "Password123!",
            "first_name": "ليلى",
            "last_name": "محمود",
            "phone_number": f"+2011{uid[:8].ljust(8, '2')}",
            "role": "ADMIN",
        },
        format="json",
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    customer = User.objects.get(username=f"s1_cust_{uid}")
    assert customer.role == User.Roles.CUSTOMER

    # 3. Login + JWT refresh cycle
    login_res = api_client.post(
        "/api/v1/auth/login/",
        {"username": customer.username, "password": "Password123!"},
        format="json",
    )
    assert login_res.status_code == status.HTTP_200_OK
    refresh_token = login_res.data["refresh"]
    refresh_res = api_client.post("/api/v1/auth/token/refresh/", {"refresh": refresh_token}, format="json")
    assert refresh_res.status_code == status.HTTP_200_OK

    cust_client = APIClient()
    cust_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh_res.data['access']}")

    # 4. Customer creates delivery address & tops up wallet within limits
    addr_res = cust_client.post(
        "/api/v1/auth/addresses/",
        {
            "title": "المنزل",
            "street": "طريق الملك فهد",
            "building_number": "22",
            "latitude": "24.714500",
            "longitude": "46.676200",
            "is_default": True,
        },
        format="json",
    )
    assert addr_res.status_code == status.HTTP_201_CREATED
    addr_id = addr_res.data["id"]

    topup_res = cust_client.post("/api/v1/customer/payments/wallet/topup/", {"amount": "400.00"}, format="json")
    assert topup_res.status_code == status.HTTP_200_OK

    # 5. Catalog search (with Meilisearch outage fallback to DB) & Store listing
    with patch("apps.menus.meilisearch_service.get_meili_client", side_effect=ConnectionError("Meili down")):
        search_res = cust_client.get("/api/v1/customer/search/?q=حليب&lat=24.7145&lng=46.6762")
        assert search_res.status_code == status.HTTP_200_OK
        assert search_res.data["total_products"] >= 1

    list_res = cust_client.get("/api/v1/customer/restaurants/?lat=24.7145&lng=46.6762")
    assert list_res.status_code == status.HTTP_200_OK
    assert any(s["id"] == str(market.id) for s in list_res.data)

    # 6. Checkout WALLET order (2x35 + 2x25 = 120 + 15 delivery = 135)
    checkout_res = cust_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(market.id),
            "delivery_address_id": addr_id,
            "payment_method": Order.PaymentMethod.WALLET,
            "items": [
                {"menu_item_id": str(milk.id), "quantity": 2},
                {"menu_item_id": str(bread.id), "quantity": 2},
            ],
        },
        format="json",
    )
    assert checkout_res.status_code == status.HTTP_201_CREATED
    order = Order.objects.get(id=checkout_res.data["id"])
    assert order.order_number.startswith("FOX-")
    assert len(order.order_number.split("-", 1)[1]) >= 8

    wallet = Wallet.objects.get(user=customer)
    assert wallet.balance == Decimal("400.00") - order.total_amount
    assert Transaction.objects.filter(wallet=wallet, transaction_type=Transaction.Types.ORDER_PAYMENT).exists()

    # 7. Merchant confirms & starts prep -> Inngest dispatch scheduled
    auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/status/",
        {"status": Order.Status.CONFIRMED, "prep_time_minutes": 10},
        format="json",
    )
    mock_inngest.assert_sent(name="order/prep.scheduled")

    # 8. Two online drivers stream GPS to Redis GEO & race to accept offer
    d1 = _make_driver("s1_d1", lat=24.7138, lon=46.6754)
    d2 = _make_driver("s1_d2", lat=24.7140, lon=46.6756)
    c_d1, _ = _jwt_client_for(d1)
    c_d2, _ = _jwt_client_for(d2)

    gps_res = c_d1.post("/api/v1/driver/gps/", {"latitude": 24.7139, "longitude": 46.6755, "speed": 20.0}, format="json")
    assert gps_res.status_code == status.HTTP_200_OK
    assert mock_redis_geo.get_driver_coords(d1.id) == (46.6755, 24.7139)

    dispatch_res = _invoke_inngest(
        fn_order_auto_dispatch_flow,
        "order/prep.scheduled",
        {"order_id": str(order.id), "prep_minutes": 10},
    )
    assert dispatch_res["status"] == "broadcasted"

    offers = list(DeliveryOffer.objects.filter(order=order, status=DeliveryOffer.Status.PENDING))
    assert len(offers) >= 2

    # Concurrent offer acceptance: first wins, second gets 409 CONFLICT
    offer_d1 = next(o for o in offers if o.driver_id == d1.id)
    offer_d2 = next(o for o in offers if o.driver_id == d2.id)
    acc1 = c_d1.post(f"/api/v1/driver/offers/{offer_d1.id}/accept/", {}, format="json")
    acc2 = c_d2.post(f"/api/v1/driver/offers/{offer_d2.id}/accept/", {}, format="json")
    assert acc1.status_code == status.HTTP_200_OK
    assert acc2.status_code == status.HTTP_409_CONFLICT

    trip = DeliveryTrip.objects.get(order=order)
    assert trip.driver == d1

    # 9. Driver picks up, streams GPS on unified channel, and completes contactless delivery with POD photo
    pickup_res = c_d1.post(f"/api/v1/driver/trips/{trip.id}/pickup/", {}, format="json")
    assert pickup_res.status_code == status.HTTP_200_OK

    mock_centrifugo.clear()
    c_d1.post("/api/v1/driver/gps/", {"latitude": 24.7145, "longitude": 46.6762, "speed": 10.0}, format="json")
    assert mock_centrifugo.has_event(channel=f"orders:order_{order.id}")

    pod_res = c_d1.post(
        f"/api/v1/driver/trips/{trip.id}/verify-otp/",
        {"is_contactless": "true", "note": "أمام الباب", "proof_photo": _make_pod_photo()},
        format="multipart",
    )
    assert pod_res.status_code == status.HTTP_200_OK

    order.refresh_from_db()
    assert order.status == Order.Status.DELIVERED
    assert mock_centrifugo.has_event(channel=f"orders:order_{order.id}")


@pytest.mark.django_db
def test_s02_supervisor_fleet_management_and_operational_governance(
    api_client,
    order_factory,
    restaurant,
    mock_centrifugo,
):
    """
    S2: Supervisor Fleet Management & Operational Governance
    Supervisor authenticated login (no hardcoded credentials) + token refresh ->
    Realtime Centrifugo token -> Live radar & unassigned orders ->
    Split cash settlements hitting cumulative daily cap -> Ops Manager approval ->
    Manual dispatch assignment broadcast on supervisor:operations + AuditLog.
    """
    PlatformSetting.objects.update_or_create(pk=1, defaults={"supervisor_max_settlement_limit": Decimal("500.00")})
    uid = uuid.uuid4().hex[:5]

    sup = User.objects.create_user(
        username=f"s2_sup_{uid}",
        password="SupSecret@2026",
        role=User.Roles.SUPERVISOR,
        is_staff=True,
    )
    ops_mgr = User.objects.create_user(
        username=f"s2_ops_{uid}",
        password="OpsSecret@2026",
        role=User.Roles.OPS_MANAGER,
        is_staff=True,
    )
    driver = _make_driver("s2_drv", cash_in_hand=Decimal("850.00"))
    order = order_factory(restaurant_instance=restaurant, status=Order.Status.READY_FOR_PICKUP)

    # 1. Authenticated supervisor login & JWT refresh
    login_res = api_client.post(
        "/api/v1/auth/login/",
        {"username": sup.username, "password": "SupSecret@2026"},
        format="json",
    )
    assert login_res.status_code == status.HTTP_200_OK
    ref_res = api_client.post("/api/v1/auth/token/refresh/", {"refresh": login_res.data["refresh"]}, format="json")
    assert ref_res.status_code == status.HTTP_200_OK

    sup_client = APIClient()
    sup_client.credentials(HTTP_AUTHORIZATION=f"Bearer {ref_res.data['access']}")

    # 2. Fetch Centrifugo WebSocket token & inspect radar/live orders
    rt_res = sup_client.get("/api/v1/realtime/token/")
    assert rt_res.status_code == status.HTTP_200_OK
    assert "token" in rt_res.data

    radar_res = sup_client.get("/api/v1/supervisor/radar/")
    assert radar_res.status_code == status.HTTP_200_OK
    assert radar_res.data["count"] >= 1

    live_res = sup_client.get("/api/v1/supervisor/dispatch/orders/?unassigned=true")
    assert live_res.status_code == status.HTTP_200_OK
    assert any(o["id"] == str(order.id) for o in live_res.data["orders"])

    # 3. Split cash settlements hitting daily cumulative cap (400 approved, +200 -> PENDING_APPROVAL)
    s1 = sup_client.post("/api/v1/supervisor/cash/settle/", {"driver_id": str(driver.id), "amount": "400.00"}, format="json")
    assert s1.status_code == status.HTTP_200_OK
    assert s1.data["status"] == "APPROVED"

    s2 = sup_client.post("/api/v1/supervisor/cash/settle/", {"driver_id": str(driver.id), "amount": "200.00"}, format="json")
    assert s2.status_code == status.HTTP_200_OK
    assert s2.data["status"] == "PENDING_APPROVAL"
    pending_id = s2.data["settlement_id"]

    # 4. Ops Manager approves flagged settlement
    ops_client, _ = _jwt_client_for(ops_mgr)
    app_res = ops_client.post(f"/api/v1/supervisor/ops/approvals/{pending_id}/", {"action": "approve"}, format="json")
    assert app_res.status_code == status.HTTP_200_OK
    driver.driver_profile.refresh_from_db()
    assert driver.driver_profile.cash_in_hand == Decimal("250.00")

    # 5. Manual dispatch assignment -> broadcast on supervisor:operations & orders:order_{id}
    mock_centrifugo.clear()
    disp_res = sup_client.post(
        "/api/v1/supervisor/dispatch/assign/",
        {"order_id": str(order.id), "driver_id": str(driver.id), "mode": "direct"},
        format="json",
    )
    assert disp_res.status_code == status.HTTP_200_OK
    assert mock_centrifugo.has_event(channel="supervisor:operations")
    assert mock_centrifugo.has_event(channel=f"orders:order_{order.id}")

    # 6. Audit log confirms governance traceability
    audit_res = ops_client.get("/api/v1/supervisor/ops/audit-log/")
    assert audit_res.status_code == status.HTTP_200_OK
    assert audit_res.data["count"] >= 3


@pytest.mark.django_db
def test_s03_variable_weight_butchery_preauth_lifecycle(
    auth_customer_client,
    auth_merchant_client,
    merchant_user,
    customer_address,
    egp_currency,
    mock_centrifugo,
    mock_inngest,
    mock_redis_geo,
):
    """
    S3: Variable-Weight Grocery/Butchery Pre-Authorization Lifecycle
    CARD order with weighted items -> 15% pre-auth hold -> Merchant prepares ->
    Merchant measures & confirms actual weights -> Final bill recomputed & hold reconciled ->
    Centrifugo orders:order_{id} weight confirmation -> Driver picks up & delivers with POD.
    """
    butchery = Restaurant.objects.create(
        owner=merchant_user,
        name="ملحمة الأصيل الطازجة",
        store_type=Restaurant.StoreType.BUTCHERY_VEG,
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
        delivery_fee=Decimal("15.00"),
        is_active=True,
    )
    cat = MenuCategory.objects.create(restaurant=butchery, name="لحوم بلدي")
    steak = MenuItem.objects.create(
        category=cat,
        name="ستيك ريب آي",
        base_price=Decimal("200.00"),
        pricing_unit=MenuItem.PricingUnit.KG,
        is_available=True,
    )

    # 1. Customer orders 2.0 KG steak via CARD -> subtotal=400.00, 15% hold=60.00, delivery=15.00, total=475.00
    checkout_res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(butchery.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.CARD,
            "items": [{"menu_item_id": str(steak.id), "quantity": 1, "requested_weight": "2.000"}],
        },
        format="json",
    )
    assert checkout_res.status_code == status.HTTP_201_CREATED
    order_id = checkout_res.data["id"]
    item_id = checkout_res.data["items"][0]["id"]
    assert Decimal(str(checkout_res.data["preauth_hold_amount"])) == Decimal("60.00")
    assert Decimal(str(checkout_res.data["total_amount"])) == Decimal("475.00")

    # 2. Merchant confirms & prepares
    auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order_id}/status/",
        {"status": Order.Status.PREPARING, "prep_time_minutes": 15},
        format="json",
    )

    # 3. Merchant weighs actual cut = 1.850 KG -> 1.850 * 200 = 370.00 + 15.00 = 385.00
    mock_centrifugo.clear()
    weight_res = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order_id}/confirm-weights/",
        {"items": [{"item_id": item_id, "actual_weight": "1.850"}]},
        format="json",
    )
    assert weight_res.status_code == status.HTTP_200_OK

    order = Order.objects.get(id=order_id)
    assert order.is_weight_confirmed is True
    assert order.subtotal == Decimal("370.00")
    assert order.total_amount == Decimal("385.00")
    assert order.preauth_hold_amount == Decimal("0.00")
    assert order.payment_status == Order.PaymentStatus.PAID
    assert mock_centrifugo.has_event(channel=f"orders:order_{order_id}")

    # 4. Driver dispatched, picks up, completes with OTP
    driver = _make_driver("s3_drv", lat=24.7137, lon=46.6754)
    drv_client, _ = _jwt_client_for(driver)
    _invoke_inngest(fn_order_auto_dispatch_flow, "order/prep.scheduled", {"order_id": str(order.id), "prep_minutes": 0})
    offer = DeliveryOffer.objects.get(order=order, driver=driver)
    drv_client.post(f"/api/v1/driver/offers/{offer.id}/accept/", {}, format="json")
    trip = DeliveryTrip.objects.get(order=order)
    drv_client.post(f"/api/v1/driver/trips/{trip.id}/pickup/", {}, format="json")
    comp_res = drv_client.post(
        f"/api/v1/driver/trips/{trip.id}/verify-otp/",
        {"otp": trip.delivery_otp},
        format="json",
    )
    assert comp_res.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.status == Order.Status.DELIVERED


@pytest.mark.django_db
def test_s04_driver_shifts_cash_settlements_and_weekly_payouts(
    api_client,
    merchant_user,
    auth_merchant_client,
    egp_currency,
    order_factory,
    mock_centrifugo,
):
    """
    S4: Driver Shifts, Cash Settlements & Payout Disbursements
    Driver authenticates via refreshed JWT -> Delivers COD order ->
    Cash handover recorded in ShiftSettlement via 6-digit OTP ->
    Store-own-fleet order prevents duplicate commission -> Weekly Inngest payout
    excludes COD from vendor disbursement -> Driver payout request via live API.
    """
    store_platform = Restaurant.objects.create(
        owner=merchant_user,
        name="مطعم منصة فوكس",
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
    )
    store_own = Restaurant.objects.create(
        owner=merchant_user,
        name="مطعم أسطول خاص فوكس",
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
    )
    merchant_wallet, _ = Wallet.objects.get_or_create(
        user=merchant_user,
        defaults={"balance": Decimal("1000.00"), "currency": "EGP"},
    )
    merchant_wallet.balance = Decimal("1000.00")
    merchant_wallet.save()

    driver = _make_driver("s4_drv")
    driver_wallet, _ = Wallet.objects.get_or_create(
        user=driver,
        defaults={"balance": Decimal("400.00"), "currency": "EGP"},
    )
    driver_wallet.balance = Decimal("400.00")
    driver_wallet.save()

    # 1. Driver authenticates via login & refresh
    login_res = api_client.post("/api/v1/auth/login/", {"username": driver.username, "password": "Password123!"}, format="json")
    assert login_res.status_code == status.HTTP_200_OK
    ref_res = api_client.post("/api/v1/auth/token/refresh/", {"refresh": login_res.data["refresh"]}, format="json")
    assert ref_res.status_code == status.HTTP_200_OK
    drv_client = APIClient()
    drv_client.credentials(HTTP_AUTHORIZATION=f"Bearer {ref_res.data['access']}")

    # 2. Driver delivers a COD order on platform-managed store -> cash_in_hand rises
    cod_order = order_factory(
        restaurant_instance=store_platform,
        status=Order.Status.ON_THE_WAY,
        payment_method=Order.PaymentMethod.COD,
        delivery_fee=Decimal("20.00"),
        items=[{"unit_price": Decimal("200.00"), "quantity": 1}],  # total = 220.00
    )
    trip = DeliveryTrip.objects.create(
        order=cod_order,
        driver=driver,
        status=DeliveryTrip.Status.PICKED_UP,
        driver_earnings=Decimal("16.00"),
    )
    otp_complete = drv_client.post(f"/api/v1/driver/trips/{trip.id}/verify-otp/", {"otp": trip.delivery_otp}, format="json")
    assert otp_complete.status_code == status.HTTP_200_OK
    driver.driver_profile.refresh_from_db()
    assert driver.driver_profile.cash_in_hand == Decimal("220.00")

    # 3. Merchant initiates ShiftSettlement & driver verifies OTP -> cash_in_hand reduced, merchant commission deducted
    settle_create = auth_merchant_client.post(
        "/api/v1/merchant/settlements/create/",
        {"driver_id": str(driver.id)},
        format="json",
    )
    assert settle_create.status_code == status.HTTP_201_CREATED
    otp_code = settle_create.data["otp_code"]

    verify_settle = drv_client.post("/api/v1/driver/settlement/verify-otp/", {"otp_code": otp_code}, format="json")
    assert verify_settle.status_code == status.HTTP_200_OK
    driver.driver_profile.refresh_from_db()
    assert driver.driver_profile.cash_in_hand == Decimal("20.00")  # 220 total - 200 subtotal goods

    # 4. Store-own-fleet order delivered twice -> idempotent commission deduction (once)
    own_order = order_factory(
        restaurant_instance=store_own,
        status=Order.Status.CONFIRMED,
        payment_method=Order.PaymentMethod.COD,
        items=[{"unit_price": Decimal("100.00"), "quantity": 1}],
    )
    auth_merchant_client.post(f"/api/v1/merchant/orders/{own_order.id}/status/", {"status": Order.Status.DELIVERED}, format="json")
    merchant_wallet.refresh_from_db()
    bal_after_first = merchant_wallet.balance
    auth_merchant_client.post(f"/api/v1/merchant/orders/{own_order.id}/status/", {"status": Order.Status.DELIVERED}, format="json")
    merchant_wallet.refresh_from_db()
    assert merchant_wallet.balance == bal_after_first

    # 5. Weekly payout Inngest job excludes COD from vendor payout disbursement
    card_order = order_factory(
        restaurant_instance=store_platform,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.CARD,
        payment_status=Order.PaymentStatus.PAID,
        items=[{"unit_price": Decimal("100.00"), "quantity": 1}],
    )
    last_week = timezone.now() - datetime.timedelta(days=3)
    Order.objects.filter(id__in=[cod_order.id, card_order.id]).update(created_at=last_week)
    DeliveryTrip.objects.filter(id=trip.id).update(completed_at=last_week)

    _invoke_inngest(fn_weekly_vendor_payouts_cron, "inngest/cron", {})
    vp = VendorPayout.objects.get(restaurant=store_platform)
    assert vp.net_payout <= Decimal("85.00")

    # 6. Driver requests payout via live API & views transaction ledger
    payout_res = drv_client.post(
        "/api/v1/driver/wallet/payout-request/",
        {"amount": "150.00", "note": "تحويل فوري"},
        format="json",
    )
    assert payout_res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
    driver_wallet.refresh_from_db()
    assert driver_wallet.balance == Decimal("250.00")


@pytest.mark.django_db
def test_s05_cancellation_coupon_restoration_and_inngest_sleep_safety(
    auth_customer_client,
    auth_merchant_client,
    customer_user,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
    mock_centrifugo,
    mock_inngest,
):
    """
    S5: Cancellation, Coupon Restoration & Inngest Sleep Safety
    Customer applies single-use coupon -> WALLET checkout -> Merchant confirms ->
    Inngest prep enters sleep -> Order cancelled during sleep ->
    Inngest wake-up sees CANCELLED and aborts dispatch ->
    Wallet refunded + CouponUsage cleared -> Coupon reused on replacement order.
    """
    _make_driver("s5_drv", lat=24.7137, lon=46.6754)
    coupon = Coupon.objects.create(
        code=f"RECOVER_{uuid.uuid4().hex[:4].upper()}",
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=Decimal("25.00"),
        min_order_amount=Decimal("40.00"),
        max_usage_per_user=1,
        valid_from=timezone.now() - datetime.timedelta(days=1),
        valid_to=timezone.now() + datetime.timedelta(days=7),
        is_active=True,
    )

    # 1. Validate coupon
    val_res = auth_customer_client.post(
        "/api/v1/customer/promotions/validate/",
        {"code": coupon.code, "subtotal": "90.00", "delivery_fee": "12.00", "restaurant_id": str(restaurant.id)},
        format="json",
    )
    assert val_res.status_code == status.HTTP_200_OK
    assert Decimal(str(val_res.data["discount_amount"])) == Decimal("25.00")

    # 2. Checkout WALLET order (subtotal 90 + delivery 12 - discount 25 = 77.00)
    checkout_res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "coupon_code": coupon.code,
            "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
        },
        format="json",
    )
    assert checkout_res.status_code == status.HTTP_201_CREATED
    order = Order.objects.get(id=checkout_res.data["id"])
    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == Decimal("923.00")
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1

    # 3. Merchant confirms -> Inngest sleep begins -> Cancelled mid-sleep
    auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/status/",
        {"status": Order.Status.CONFIRMED, "prep_time_minutes": 15},
        format="json",
    )
    mock_centrifugo.clear()

    def _cancel_while_sleeping(step_id, duration):
        auth_merchant_client.post(
            f"/api/v1/merchant/orders/{order.id}/status/",
            {"status": Order.Status.CANCELLED, "reason": "إلغاء قبل الإرسال"},
            format="json",
        )

    wake_res = _invoke_inngest(
        fn_order_auto_dispatch_flow,
        "order/prep.scheduled",
        {"order_id": str(order.id), "prep_minutes": 15},
        on_sleep=_cancel_while_sleeping,
    )

    # 4. Dispatch aborted, wallet refunded, CouponUsage cleared, Centrifugo broadcast sent
    assert DeliveryOffer.objects.filter(order=order).count() == 0
    assert wake_res.get("status") in ("cancelled", "order_cancelled", "aborted")
    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == Decimal("1000.00")
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0
    assert mock_centrifugo.has_event(channel=f"orders:order_{order.id}")

    # 5. Customer re-applies exact same coupon on replacement order
    retry_res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "coupon_code": coupon.code,
            "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
        },
        format="json",
    )
    assert retry_res.status_code == status.HTTP_201_CREATED
    assert Decimal(str(retry_res.data["discount_amount"])) == Decimal("25.00")


# ============================================================================
# S6–S16: Additional End-to-End Multi-Step Real-World Application Scenarios
# ============================================================================


@pytest.mark.django_db
def test_s06_mixed_weighted_and_standard_cart_with_partial_weight_adjustment(
    auth_customer_client,
    auth_merchant_client,
    restaurant,
    customer_address,
    menu_item,
    weighted_menu_item,
    mock_centrifugo,
):
    """S6: Mixed Cart (PIECE + Modifiers + KG Weighted Item) -> CARD Pre-Auth -> Partial Weight Confirmation."""
    mod_large = menu_item.modifier_groups.first().modifiers.get(price_delta=Decimal("10.00"))
    # Item 1: 45 + 10 = 55 x 2 = 110.00 (non-weighted)
    # Item 2: 120 * 1.5 KG = 180.00 (weighted -> 15% hold = 27.00)
    # Delivery: 12.00; Total with hold = 110 + 180 + 12 + 27 = 329.00
    res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.CARD,
            "items": [
                {"menu_item_id": str(menu_item.id), "quantity": 2, "modifier_ids": [str(mod_large.id)]},
                {"menu_item_id": str(weighted_menu_item.id), "quantity": 1, "requested_weight": "1.500"},
            ],
        },
        format="json",
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert Decimal(str(res.data["subtotal"])) == Decimal("290.00")
    assert Decimal(str(res.data["preauth_hold_amount"])) == Decimal("27.00")
    assert Decimal(str(res.data["total_amount"])) == Decimal("329.00")

    order = Order.objects.get(id=res.data["id"])
    w_item = order.items.get(is_weighted=True)
    # Actual weight = 1.250 KG -> 150.00; non-weighted stays 110.00 -> new subtotal = 260.00 + 12.00 = 272.00
    conf_res = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/confirm-weights/",
        {"items": [{"item_id": str(w_item.id), "actual_weight": "1.250"}]},
        format="json",
    )
    assert conf_res.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.subtotal == Decimal("260.00")
    assert order.total_amount == Decimal("272.00")
    assert order.preauth_hold_amount == Decimal("0.00")


@pytest.mark.django_db
def test_s07_merchant_order_rejection_full_recovery_and_notifications(
    auth_customer_client,
    auth_merchant_client,
    customer_user,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
    egp_currency,
    mock_centrifugo,
):
    """S7: Merchant Order Rejection -> Automated Wallet Refund, Coupon Restore & Replacement Order."""
    alt_merchant = User.objects.create_user(
        username=f"alt_merch_{uuid.uuid4().hex[:5]}",
        password="Password123!",
        role=User.Roles.MERCHANT,
    )
    alt_store = Restaurant.objects.create(
        owner=alt_merchant,
        name="بيتزا بديلة",
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
    )
    alt_cat = MenuCategory.objects.create(restaurant=alt_store, name="بيتزا")
    alt_item = MenuItem.objects.create(category=alt_cat, name="مارجريتا", base_price=Decimal("50.00"), is_available=True)

    coupon = Coupon.objects.create(
        code=f"ALT15_{uuid.uuid4().hex[:4].upper()}",
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=Decimal("15.00"),
        valid_from=timezone.now() - datetime.timedelta(days=1),
        valid_to=timezone.now() + datetime.timedelta(days=5),
        is_active=True,
    )

    r1 = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "coupon_code": coupon.code,
            "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
        },
        format="json",
    )
    assert r1.status_code == status.HTTP_201_CREATED
    o1_id = r1.data["id"]

    # Merchant rejects
    mock_centrifugo.clear()
    rej = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{o1_id}/status/",
        {"status": Order.Status.CANCELLED, "reason": "نفدت العجينة"},
        format="json",
    )
    assert rej.status_code == status.HTTP_200_OK
    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == Decimal("1000.00")
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0
    assert mock_centrifugo.has_event(channel=f"orders:order_{o1_id}")

    # Customer immediately orders from alt_store with restored coupon
    r2 = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(alt_store.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "coupon_code": coupon.code,
            "items": [{"menu_item_id": str(alt_item.id), "quantity": 2}],
        },
        format="json",
    )
    assert r2.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_s08_driver_multi_batch_timeout_rejection_and_manual_dispatch_fallback(
    auth_supervisor_client,
    order_factory,
    restaurant,
    mock_centrifugo,
    mock_inngest,
):
    """S8: Batch 1 Reject -> Batch 2 Radius Expansion Timeout -> Supervisor Manual Dispatch -> Completion."""
    d_b1 = _make_driver("s8_b1", lat=24.7137, lon=46.6754)
    d_b2 = _make_driver("s8_b2", lat=24.7800, lon=46.6753)  # ~7.4km (Batch 2 10km)
    d_manual = _make_driver("s8_man", lat=24.7200, lon=46.6800, is_online=False)  # Offline, assigned manually
    order = order_factory(restaurant_instance=restaurant, status=Order.Status.PREPARING)

    # Batch 1 -> d_b1 rejects
    _invoke_inngest(fn_order_auto_dispatch_flow, "order/prep.scheduled", {"order_id": str(order.id), "prep_minutes": 0})
    o_b1 = DeliveryOffer.objects.get(order=order, driver=d_b1, batch_number=1)
    c_b1, _ = _jwt_client_for(d_b1)
    assert c_b1.post(f"/api/v1/driver/offers/{o_b1.id}/reject/", {}, format="json").status_code == status.HTTP_200_OK

    # Batch 1 handler escalates to Batch 2 (10km) -> d_b2 gets offer, d_b1 excluded
    _invoke_inngest(fn_driver_offer_timeout_handler, "delivery/offers.broadcasted", {"order_id": str(order.id), "batch": 1, "timeout_seconds": 45})
    assert not DeliveryOffer.objects.filter(order=order, driver=d_b1, batch_number=2).exists()
    assert DeliveryOffer.objects.filter(order=order, driver=d_b2, batch_number=2).exists()

    # Batch 2 & Batch 3 time out -> triggers manual dispatch alert
    _invoke_inngest(fn_driver_offer_timeout_handler, "delivery/offers.broadcasted", {"order_id": str(order.id), "batch": 2, "timeout_seconds": 45})
    res_b3 = _invoke_inngest(fn_driver_offer_timeout_handler, "delivery/offers.broadcasted", {"order_id": str(order.id), "batch": 3, "timeout_seconds": 45})
    assert res_b3["status"] == "manual_dispatch_required"

    # Supervisor manually dispatches d_manual
    disp = auth_supervisor_client.post(
        "/api/v1/supervisor/dispatch/assign/",
        {"order_id": str(order.id), "driver_id": str(d_manual.id), "mode": "direct"},
        format="json",
    )
    assert disp.status_code == status.HTTP_200_OK

    c_man, _ = _jwt_client_for(d_manual)
    trip = DeliveryTrip.objects.get(order=order)
    assert c_man.post(f"/api/v1/driver/trips/{trip.id}/pickup/", {}, format="json").status_code == status.HTTP_200_OK
    assert c_man.post(f"/api/v1/driver/trips/{trip.id}/verify-otp/", {"otp": trip.delivery_otp}, format="json").status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_s09_rush_hour_concurrent_order_wave_and_offer_race(
    auth_customer_client,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
    mock_centrifugo,
    mock_inngest,
):
    """S9: Rush-Hour Order Wave (5 orders) -> Unique Order Numbers -> Offer Competition Integrity."""
    drivers = [_make_driver(f"s9_d{i}", lat=24.7136 + (i * 0.0002), lon=46.6753) for i in range(4)]
    orders = []

    for _ in range(5):
        r = auth_customer_client.post(
            "/api/v1/customer/orders/checkout/",
            {
                "restaurant_id": str(restaurant.id),
                "delivery_address_id": str(customer_address.id),
                "payment_method": Order.PaymentMethod.WALLET,
                "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
            },
            format="json",
        )
        assert r.status_code == status.HTTP_201_CREATED
        orders.append(Order.objects.get(id=r.data["id"]))

    order_numbers = [o.order_number for o in orders]
    assert len(set(order_numbers)) == 5

    # Dispatch first order -> 3 drivers receive offers; 2 try to accept concurrently -> 1 wins
    _invoke_inngest(fn_order_auto_dispatch_flow, "order/prep.scheduled", {"order_id": str(orders[0].id), "prep_minutes": 0})
    offers = list(DeliveryOffer.objects.filter(order=orders[0], status=DeliveryOffer.Status.PENDING))
    assert len(offers) >= 2

    winner_client, _ = _jwt_client_for(offers[0].driver)
    loser_client, _ = _jwt_client_for(offers[1].driver)
    assert winner_client.post(f"/api/v1/driver/offers/{offers[0].id}/accept/", {}, format="json").status_code == status.HTTP_200_OK
    assert loser_client.post(f"/api/v1/driver/offers/{offers[1].id}/accept/", {}, format="json").status_code == status.HTTP_409_CONFLICT
    assert DeliveryTrip.objects.filter(order=orders[0]).count() == 1


@pytest.mark.django_db
def test_s10_driver_cod_ceiling_lockout_and_supervisor_reconciliation_recovery(
    auth_supervisor_client,
    order_factory,
    restaurant,
    mock_centrifugo,
    mock_inngest,
):
    """S10: Driver Hits COD Ceiling -> Excluded from Dispatch -> Cash Deposit / Settlement -> Re-enabled."""
    PlatformSetting.objects.update_or_create(pk=1, defaults={"cod_max_ceiling": Decimal("500.00")})
    driver = _make_driver("s10_drv", lat=24.7137, lon=46.6754, cash_in_hand=Decimal("400.00"))
    drv_client, _ = _jwt_client_for(driver)

    # Complete one 150.00 COD delivery -> cash_in_hand becomes 550.00 >= 500.00 ceiling
    o1 = order_factory(
        restaurant_instance=restaurant,
        status=Order.Status.ON_THE_WAY,
        payment_method=Order.PaymentMethod.COD,
        delivery_fee=Decimal("10.00"),
        items=[{"unit_price": Decimal("140.00"), "quantity": 1}],
    )
    trip1 = DeliveryTrip.objects.create(order=o1, driver=driver, status=DeliveryTrip.Status.PICKED_UP)
    assert drv_client.post(f"/api/v1/driver/trips/{trip1.id}/verify-otp/", {"otp": trip1.delivery_otp}, format="json").status_code == status.HTTP_200_OK

    driver.driver_profile.refresh_from_db()
    assert driver.driver_profile.cash_in_hand == Decimal("550.00")

    # Reconciliation API flags driver over ceiling
    rec_res = auth_supervisor_client.get("/api/v1/supervisor/cash/reconciliation/")
    assert rec_res.status_code == status.HTTP_200_OK
    drv_rec = next(d for d in rec_res.data["drivers"] if d["id"] == str(driver.id))
    assert drv_rec["is_over_limit"] is True

    # Auto-dispatch skips locked-out driver
    o2 = order_factory(restaurant_instance=restaurant, status=Order.Status.PREPARING)
    res_disp = _invoke_inngest(fn_order_auto_dispatch_flow, "order/prep.scheduled", {"order_id": str(o2.id), "prep_minutes": 0})
    assert res_disp["status"] == "no_candidates"

    # Driver submits cash deposit / supervisor settles -> drops below ceiling
    dep_res = drv_client.post(
        "/api/v1/driver/wallet/cash-deposit/",
        {"amount": "300.00", "reference_number": "CASH-REC-001"},
        format="json",
    )
    assert dep_res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    res_disp2 = _invoke_inngest(fn_order_auto_dispatch_flow, "order/prep.scheduled", {"order_id": str(o2.id), "prep_minutes": 0})
    assert res_disp2["status"] == "broadcasted"


@pytest.mark.django_db
def test_s11_multi_restaurant_store_own_fleet_vs_platform_managed_lifecycle(
    auth_customer_client,
    auth_merchant_client,
    merchant_user,
    customer_wallet,
    customer_address,
    egp_currency,
    mock_inngest,
    mock_centrifugo,
):
    """S11: Customer Orders from Both PLATFORM_MANAGED and STORE_OWN_FLEET Stores -> Distinct Workflows."""
    store_plat = Restaurant.objects.create(
        owner=merchant_user,
        name="متجر أسطول المنصة",
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
    )
    store_own = Restaurant.objects.create(
        owner=merchant_user,
        name="متجر الأسطول الخاص",
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
    )
    i_plat = MenuItem.objects.create(category=MenuCategory.objects.create(restaurant=store_plat, name="ع"), name="صنف منصة", base_price=Decimal("60.00"))
    i_own = MenuItem.objects.create(category=MenuCategory.objects.create(restaurant=store_own, name="ع"), name="صنف خاص", base_price=Decimal("80.00"))

    r_plat = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {"restaurant_id": str(store_plat.id), "delivery_address_id": str(customer_address.id), "payment_method": "WALLET", "items": [{"menu_item_id": str(i_plat.id), "quantity": 1}]},
        format="json",
    )
    r_own = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {"restaurant_id": str(store_own.id), "delivery_address_id": str(customer_address.id), "payment_method": "COD", "items": [{"menu_item_id": str(i_own.id), "quantity": 1}]},
        format="json",
    )
    assert r_plat.status_code == status.HTTP_201_CREATED
    assert r_own.status_code == status.HTTP_201_CREATED

    # Confirming store_own does NOT trigger Inngest dispatch
    auth_merchant_client.post(f"/api/v1/merchant/orders/{r_own.data['id']}/status/", {"status": Order.Status.CONFIRMED}, format="json")
    assert not mock_inngest.has_event(name="order/prep.scheduled")

    # Confirming store_plat DOES trigger Inngest dispatch
    auth_merchant_client.post(f"/api/v1/merchant/orders/{r_plat.data['id']}/status/", {"status": Order.Status.CONFIRMED}, format="json")
    mock_inngest.assert_sent(name="order/prep.scheduled", count=1)

    # Merchant directly completes store_own
    assert auth_merchant_client.post(f"/api/v1/merchant/orders/{r_own.data['id']}/status/", {"status": Order.Status.ON_THE_WAY}, format="json").status_code == status.HTTP_200_OK
    assert auth_merchant_client.post(f"/api/v1/merchant/orders/{r_own.data['id']}/status/", {"status": Order.Status.DELIVERED}, format="json").status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_s12_delivery_zone_geofencing_dynamic_surge_and_out_of_zone_rejection(
    auth_customer_client,
    customer_user,
    merchant_user,
    egp_currency,
    customer_address,
):
    """S12: Reconciled DeliveryZone Polygon + Surge -> In-Zone Checkout Succeeds, Out-of-Zone Rejected."""
    zone = StoreDeliveryZone.objects.create(
        name="زون المربع الذهبي",
        city="الرياض",
        currency=egp_currency,
        base_delivery_fee=Decimal("20.00"),
        base_distance_km=Decimal("3.00"),
        per_km_fee=Decimal("2.00"),
        max_delivery_fee=Decimal("60.00"),
        is_manual_surge_active=True,
        manual_surge_percent=Decimal("25.00"),
        polygon_coordinates=[[24.70, 46.65], [24.70, 46.70], [24.75, 46.70], [24.75, 46.65]],
        is_active=True,
    )
    store = Restaurant.objects.create(
        owner=merchant_user,
        name="متجر الزون المغلق",
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
        delivery_fee=Decimal("20.00"),
    )
    store.delivery_zones.add(zone)
    item = MenuItem.objects.create(category=MenuCategory.objects.create(restaurant=store, name="عام"), name="منتج", base_price=Decimal("50.00"))

    # Inside polygon succeeds with 25% surge (20 * 1.25 = 25.00)
    ok_res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {"restaurant_id": str(store.id), "delivery_address_id": str(customer_address.id), "payment_method": "COD", "items": [{"menu_item_id": str(item.id), "quantity": 1}]},
        format="json",
    )
    assert ok_res.status_code == status.HTTP_201_CREATED
    assert Decimal(str(ok_res.data["delivery_fee"])) == Decimal("25.00")
    assert ok_res.data["is_surge_applied"] is True

    # Out-of-zone address rejected at checkout
    far_addr = Address.objects.create(user=customer_user, title="بعيد", street="الخارج", latitude=Decimal("24.900000"), longitude=Decimal("46.900000"))
    fail_res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {"restaurant_id": str(store.id), "delivery_address_id": str(far_addr.id), "payment_method": "COD", "items": [{"menu_item_id": str(item.id), "quantity": 1}]},
        format="json",
    )
    assert fail_res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_s13_high_frequency_driver_gps_telemetry_and_customer_tracking(
    auth_customer_client,
    auth_driver_client,
    driver_user,
    order_factory,
    mock_redis_geo,
    mock_centrifugo,
):
    """S13: High-Frequency Driver GPS Pings -> Redis GEO + Unified orders:order_{id} + Customer Order View."""
    order = order_factory(status=Order.Status.ON_THE_WAY)
    DeliveryTrip.objects.create(order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP)

    mock_centrifugo.clear()
    for step in range(10):
        lat = round(24.7136 + step * 0.0003, 6)
        lon = round(46.6753 + step * 0.0003, 6)
        r = auth_driver_client.post("/api/v1/driver/gps/", {"latitude": lat, "longitude": lon, "heading": 120.0, "speed": 42.0}, format="json")
        assert r.status_code == status.HTTP_200_OK

    # Latest GPS in Redis GEO
    expected_lat = round(24.7136 + 9 * 0.0003, 6)
    expected_lon = round(46.6753 + 9 * 0.0003, 6)
    assert mock_redis_geo.get_driver_coords(driver_user.id) == (expected_lon, expected_lat)

    # Customer order detail exposes live driver coordinates
    cust_detail = auth_customer_client.get(f"/api/v1/customer/orders/{order.id}/")
    assert cust_detail.status_code == status.HTTP_200_OK
    assert cust_detail.data["delivery_info"]["driver_latitude"] == expected_lat
    assert cust_detail.data["delivery_info"]["driver_longitude"] == expected_lon

    # All broadcasts landed on unified orders:order_{id}
    assert len(mock_centrifugo.filter(channel=f"orders:order_{order.id}")) >= 10


@pytest.mark.django_db
def test_s14_meilisearch_resilience_outage_to_recovery_catalog_flow(
    auth_customer_client,
    auth_merchant_client,
    merchant_user,
    customer_address,
    egp_currency,
):
    """S14: Meilisearch Outage Fallback -> Merchant Adds Item -> Cache Invalidated -> Search & Checkout."""
    store = Restaurant.objects.create(
        owner=merchant_user,
        name="صيدلية الشفاء فوكس",
        store_type=Restaurant.StoreType.PHARMACY,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
        delivery_radius_km=15.0,
    )
    cat = MenuCategory.objects.create(restaurant=store, name="فيتامينات")
    vit_c = MenuItem.objects.create(category=cat, name="فيتامين سي فوار", base_price=Decimal("45.00"), barcode="6221234567890")

    # 1. Search during Meilisearch outage falls back cleanly to DB
    with patch("apps.menus.meilisearch_service.get_meili_client", side_effect=RuntimeError("Meilisearch unreachable")):
        r_search = auth_customer_client.get("/api/v1/customer/search/?q=فيتامين&lat=24.7136&lng=46.6753")
        assert r_search.status_code == status.HTTP_200_OK
        assert r_search.data["total_products"] >= 1

    # 2. Merchant creates new item -> search cache invalidated -> searchable by barcode/query -> checkout
    zinc = MenuItem.objects.create(category=cat, name="زنك بلس", base_price=Decimal("55.00"), barcode="6229998887771")
    from apps.restaurants.views import invalidate_search_cache
    invalidate_search_cache()

    r_barcode = auth_customer_client.get("/api/v1/customer/search/?barcode=6229998887771&lat=24.7136&lng=46.6753")
    assert r_barcode.status_code == status.HTTP_200_OK
    assert any(p["id"] == str(zinc.id) for p in r_barcode.data["products"])

    r_order = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(store.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.COD,
            "items": [{"menu_item_id": str(vit_c.id), "quantity": 1}, {"menu_item_id": str(zinc.id), "quantity": 1}],
        },
        format="json",
    )
    assert r_order.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_s15_supervisor_ops_team_zone_assignment_and_audit_trail(
    auth_supervisor_client,
    order_factory,
    restaurant,
    mock_centrifugo,
):
    """S15: Ops Manager Creates Zone & Supervisor -> Supervisor Dispatches & Settles -> Ops Analytics & Audit."""
    uid = uuid.uuid4().hex[:5]
    # 1. Ops Manager creates operational zone
    z_res = auth_supervisor_client.post(
        "/api/v1/supervisor/ops/zones/",
        {"name": "قطاع الشمال", "code": f"NORTH_{uid.upper()}", "city": "الرياض", "center_latitude": "24.7500", "center_longitude": "46.6800", "radius_km": 8.0},
        format="json",
    )
    assert z_res.status_code == status.HTTP_201_CREATED
    zone_id = z_res.data["id"]

    # 2. Ops Manager creates new SUPERVISOR assigned to zone
    sup_res = auth_supervisor_client.post(
        "/api/v1/supervisor/ops/team/",
        {
            "username": f"sup_north_{uid}",
            "password": "SupPass@123",
            "first_name": "خالد",
            "last_name": "الشمري",
            "role": "SUPERVISOR",
            "zone_ids": [zone_id],
        },
        format="json",
    )
    assert sup_res.status_code == status.HTTP_201_CREATED
    new_sup = User.objects.get(id=sup_res.data["id"])
    sup_client, _ = _jwt_client_for(new_sup)

    # 3. Supervisor views zones, manually dispatches order, settles cash
    assert sup_client.get("/api/v1/supervisor/ops/zones/").status_code == status.HTTP_200_OK
    driver = _make_driver("s15_drv", cash_in_hand=Decimal("300.00"))
    order = order_factory(restaurant_instance=restaurant, status=Order.Status.READY_FOR_PICKUP)

    assert sup_client.post("/api/v1/supervisor/dispatch/assign/", {"order_id": str(order.id), "driver_id": str(driver.id), "mode": "direct"}, format="json").status_code == status.HTTP_200_OK
    assert sup_client.post("/api/v1/supervisor/cash/settle/", {"driver_id": str(driver.id), "amount": "250.00"}, format="json").status_code == status.HTTP_200_OK

    # 4. Ops Manager inspects analytics & audit log
    kpi_res = auth_supervisor_client.get("/api/v1/supervisor/ops/analytics/")
    assert kpi_res.status_code == status.HTTP_200_OK
    assert kpi_res.data["dispatches"]["manual_dispatches_today"] >= 1
    assert kpi_res.data["cash"]["approved_settlements_today"] >= 250.0

    audit_res = auth_supervisor_client.get(f"/api/v1/supervisor/ops/audit-log/?actor_id={new_sup.id}")
    assert audit_res.status_code == status.HTTP_200_OK
    assert audit_res.data["count"] >= 2


@pytest.mark.django_db
def test_s16_wallet_topup_cap_enforcement_and_multi_order_ledger_integrity(
    auth_customer_client,
    zero_balance_wallet,
    restaurant,
    customer_address,
    menu_item,
    mock_centrifugo,
):
    """S16: Top-Up Cap Enforcement -> Two Bounded Top-Ups -> Order Paid + Order Cancelled/Refunded -> Exact Ledger."""
    # 1. Unconstrained huge top-up blocked
    r_bad = auth_customer_client.post("/api/v1/customer/payments/wallet/topup/", {"amount": "500000.00"}, format="json")
    assert r_bad.status_code == status.HTTP_400_BAD_REQUEST

    # 2. Valid bounded top-ups (200 + 150 = 350.00)
    assert auth_customer_client.post("/api/v1/customer/payments/wallet/topup/", {"amount": "200.00"}, format="json").status_code == status.HTTP_200_OK
    assert auth_customer_client.post("/api/v1/customer/payments/wallet/topup/", {"amount": "150.00"}, format="json").status_code == status.HTTP_200_OK

    # 3. Order 1 placed & kept (45*2 + 12 = 102.00)
    o1 = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {"restaurant_id": str(restaurant.id), "delivery_address_id": str(customer_address.id), "payment_method": "WALLET", "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}]},
        format="json",
    )
    assert o1.status_code == status.HTTP_201_CREATED

    # 4. Order 2 placed & cancelled -> refunded (45*1 + 12 = 57.00)
    o2 = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {"restaurant_id": str(restaurant.id), "delivery_address_id": str(customer_address.id), "payment_method": "WALLET", "items": [{"menu_item_id": str(menu_item.id), "quantity": 1}]},
        format="json",
    )
    assert o2.status_code == status.HTTP_201_CREATED
    assert auth_customer_client.post(f"/api/v1/customer/orders/{o2.data['id']}/cancel/", {}, format="json").status_code == status.HTTP_200_OK

    # 5. Final wallet balance must equal exact algebraic sum of all Transaction ledger entries
    zero_balance_wallet.refresh_from_db()
    ledger_sum = sum(t.amount for t in Transaction.objects.filter(wallet=zero_balance_wallet))
    assert zero_balance_wallet.balance == Decimal("248.00")
    assert zero_balance_wallet.balance == ledger_sum
