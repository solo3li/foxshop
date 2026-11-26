"""
Tier 3: Pairwise Cross-Feature Combination E2E Tests
=====================================================
Requirement-driven opaque-box tests exercising pairwise interactions across
FoxShop's five subsystems (Security, Financial/Wallet, Dispatch/Workflow,
Real-Time/Inngest, and Search/Performance).

Authoritative Specifications:
- ORIGINAL_REQUEST.md (R1–R5)
- PROJECT.md (Interface Contracts & Milestones M1–M5)
- TEST_INFRA.md (Feature Matrix & Coverage Thresholds)
"""

import io
import json
import types
import uuid
import datetime
from decimal import Decimal
from unittest.mock import patch

import inngest
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Address, PlatformSetting, User
from apps.deliveries.dispatch import (
    accept_delivery_offer,
    broadcast_delivery_offers,
    find_candidate_drivers,
    reject_delivery_offer,
)
from apps.deliveries.inngest_functions import (
    fn_driver_offer_timeout_handler,
    fn_order_auto_dispatch_flow,
    fn_weekly_vendor_payouts_cron,
)
from apps.deliveries.models import (
    DeliveryOffer,
    DeliveryTrip,
    DeliveryZone as OpsDeliveryZone,
    DriverCashSettlement,
    DriverProfile,
    ShiftSettlement,
    SupervisorActionLog,
)
from apps.deliveries.services import update_driver_gps
from apps.menus.models import MenuCategory, MenuItem, Modifier, ModifierGroup
from apps.orders.models import Order, OrderItem
from apps.payments.models import PayoutCycle, Transaction, VendorPayout, Wallet
from apps.promotions.models import Coupon, CouponUsage
from apps.restaurants.models import DeliveryZone as StoreDeliveryZone, Restaurant


# ============================================================================
# Shared Helpers for Tier 3 Pairwise Tests
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


def _make_driver(username_prefix, lat=24.7136, lon=46.6753, cash_in_hand=Decimal("0.00"), is_online=True):
    uid = uuid.uuid4().hex[:6]
    user = User.objects.create_user(
        username=f"{username_prefix}_{uid}",
        password="password123",
        first_name="كابتن",
        last_name=uid,
        phone_number=f"+96655{uid[:7]}",
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


def _make_image_upload(name="pod_proof.png"):
    return SimpleUploadedFile(name, MINIMAL_PNG_BYTES, content_type="image/png")


# ============================================================================
# T3-01 to T3-10: Payment, Pre-Auth Hold, Wallet, Coupon & Commission Pairs
# ============================================================================


@pytest.mark.django_db
def test_t3_01_card_weighted_item_confirm_weights_and_hold_capture(
    auth_customer_client,
    auth_merchant_client,
    restaurant,
    customer_address,
    weighted_menu_item,
    mock_centrifugo,
):
    """Pair 1: CARD Payment + Variable Weight Item + Weight Confirmation + Hold Capture."""
    # Checkout 2.0 KG @ 120.00 = 240.00; 15% pre-auth hold = 36.00; delivery = 12.00; total = 288.00
    checkout_payload = {
        "restaurant_id": str(restaurant.id),
        "delivery_address_id": str(customer_address.id),
        "payment_method": Order.PaymentMethod.CARD,
        "items": [
            {
                "menu_item_id": str(weighted_menu_item.id),
                "quantity": 1,
                "requested_weight": "2.000",
            }
        ],
    }
    res = auth_customer_client.post("/api/v1/customer/orders/checkout/", checkout_payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED
    order_id = res.data["id"]
    assert Decimal(str(res.data["subtotal"])) == Decimal("240.00")
    assert Decimal(str(res.data["preauth_hold_amount"])) == Decimal("36.00")
    assert Decimal(str(res.data["total_amount"])) == Decimal("288.00")

    order_item_id = res.data["items"][0]["id"]
    mock_centrifugo.clear()

    # Merchant confirms actual weight = 2.150 KG -> 2.150 * 120 = 258.00 + delivery 12.00 = 270.00
    confirm_payload = {
        "items": [{"item_id": order_item_id, "actual_weight": "2.150"}]
    }
    res_confirm = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order_id}/confirm-weights/",
        confirm_payload,
        format="json",
    )
    assert res_confirm.status_code == status.HTTP_200_OK

    order = Order.objects.get(id=order_id)
    assert order.is_weight_confirmed is True
    assert order.payment_status == Order.PaymentStatus.PAID
    assert order.subtotal == Decimal("258.00")
    assert order.total_amount == Decimal("270.00")
    # Pre-auth hold reconciled/released after capture
    assert order.preauth_hold_amount == Decimal("0.00")

    # Centrifugo weight confirmation event broadcast on unified orders:order_{id}
    events = mock_centrifugo.filter(channel=f"orders:order_{order_id}")
    assert len(events) >= 1
    assert any(
        ev.event_type in ("WEIGHTS_CONFIRMED", "order.weight_confirmed")
        for ev in events
    )


@pytest.mark.django_db
def test_t3_02_card_weighted_item_cancel_and_hold_release(
    auth_customer_client,
    restaurant,
    customer_address,
    weighted_menu_item,
    mock_centrifugo,
):
    """Pair 2: CARD Payment + Variable Weight Item + Customer Cancellation + Hold Release/Refund."""
    checkout_payload = {
        "restaurant_id": str(restaurant.id),
        "delivery_address_id": str(customer_address.id),
        "payment_method": Order.PaymentMethod.CARD,
        "items": [
            {
                "menu_item_id": str(weighted_menu_item.id),
                "quantity": 1,
                "requested_weight": "1.500",
            }
        ],
    }
    res = auth_customer_client.post("/api/v1/customer/orders/checkout/", checkout_payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED
    order_id = res.data["id"]
    assert Decimal(str(res.data["preauth_hold_amount"])) == Decimal("27.00")

    mock_centrifugo.clear()
    cancel_res = auth_customer_client.post(f"/api/v1/customer/orders/{order_id}/cancel/", {}, format="json")
    assert cancel_res.status_code == status.HTTP_200_OK

    order = Order.objects.get(id=order_id)
    assert order.status == Order.Status.CANCELLED
    assert order.preauth_hold_amount == Decimal("0.00")
    assert order.payment_status == Order.PaymentStatus.REFUNDED
    mock_centrifugo.assert_published(channel=f"orders:order_{order_id}")


@pytest.mark.django_db
def test_t3_03_wallet_prep_sleep_cancel_refund_and_ledger(
    auth_customer_client,
    auth_merchant_client,
    customer_user,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
    mock_inngest,
    mock_centrifugo,
):
    """Pair 3: WALLET Payment + Inngest Prep Sleep + Order Cancellation + Wallet Refund + Ledger."""
    initial_balance = customer_wallet.balance  # 1000.00
    checkout_payload = {
        "restaurant_id": str(restaurant.id),
        "delivery_address_id": str(customer_address.id),
        "payment_method": Order.PaymentMethod.WALLET,
        "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
    }
    res = auth_customer_client.post("/api/v1/customer/orders/checkout/", checkout_payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED
    order = Order.objects.get(id=res.data["id"])

    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == initial_balance - order.total_amount
    assert Transaction.objects.filter(
        wallet=customer_wallet,
        transaction_type=Transaction.Types.ORDER_PAYMENT,
    ).exists()

    # Merchant confirms -> schedules Inngest prep workflow
    auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/status/",
        {"status": Order.Status.CONFIRMED, "prep_time_minutes": 15},
        format="json",
    )
    mock_inngest.assert_sent(name="order/prep.scheduled")

    # During Inngest sleep interval, order is cancelled (e.g., merchant cancels)
    def _cancel_during_sleep(step_id, duration):
        auth_merchant_client.post(
            f"/api/v1/merchant/orders/{order.id}/status/",
            {"status": Order.Status.CANCELLED, "reason": "نفدت المكونات"},
            format="json",
        )

    result = _invoke_inngest(
        fn_order_auto_dispatch_flow,
        "order/prep.scheduled",
        {"order_id": str(order.id), "prep_minutes": 15},
        on_sleep=_cancel_during_sleep,
    )

    order.refresh_from_db()
    customer_wallet.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert order.payment_status == Order.PaymentStatus.REFUNDED
    assert customer_wallet.balance == initial_balance
    assert Transaction.objects.filter(
        wallet=customer_wallet,
        transaction_type=Transaction.Types.REFUND,
        amount=order.total_amount,
    ).exists()
    assert DeliveryOffer.objects.filter(order=order).count() == 0
    assert result.get("status") in ("cancelled", "order_cancelled", "aborted")


@pytest.mark.django_db
def test_t3_04_coupon_cancel_usage_restoration_and_reuse(
    auth_customer_client,
    customer_user,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
):
    """Pair 4: Coupon Discount + Order Cancellation + CouponUsage Restoration + Re-apply to New Order."""
    coupon = Coupon.objects.create(
        code=f"SAVE20_{uuid.uuid4().hex[:4].upper()}",
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=Decimal("20.00"),
        min_order_amount=Decimal("40.00"),
        max_usage_per_user=1,
        valid_from=timezone.now() - datetime.timedelta(days=1),
        valid_to=timezone.now() + datetime.timedelta(days=7),
        is_active=True,
    )

    payload = {
        "restaurant_id": str(restaurant.id),
        "delivery_address_id": str(customer_address.id),
        "payment_method": Order.PaymentMethod.WALLET,
        "coupon_code": coupon.code,
        "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
    }
    res1 = auth_customer_client.post("/api/v1/customer/orders/checkout/", payload, format="json")
    assert res1.status_code == status.HTTP_201_CREATED
    order1_id = res1.data["id"]
    assert Decimal(str(res1.data["discount_amount"])) == Decimal("20.00")
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1

    # Cancel first order -> CouponUsage must be cleared
    cancel_res = auth_customer_client.post(f"/api/v1/customer/orders/{order1_id}/cancel/", {}, format="json")
    assert cancel_res.status_code == status.HTTP_200_OK
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0

    # Re-apply exact same coupon to a new order
    res2 = auth_customer_client.post("/api/v1/customer/orders/checkout/", payload, format="json")
    assert res2.status_code == status.HTTP_201_CREATED
    assert Decimal(str(res2.data["discount_amount"])) == Decimal("20.00")
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1


@pytest.mark.django_db
def test_t3_05_inngest_batch1_timeout_exclusion_and_batch2_accept(
    order_factory,
    restaurant,
    mock_inngest,
    mock_centrifugo,
):
    """Pair 5: Inngest Batch 1 Driver Timeout + Exclusion in Batch 2 + Batch 2 Acceptance."""
    driver1 = _make_driver("drv_b1", lat=24.7137, lon=46.6754)
    driver2 = _make_driver("drv_b2", lat=24.7600, lon=46.7000)  # ~5.8km away (Batch 2 10km)
    order = order_factory(status=Order.Status.PREPARING, restaurant_instance=restaurant)

    # Batch 1 broadcast finds driver1 within 5km
    res_b1 = _invoke_inngest(
        fn_order_auto_dispatch_flow,
        "order/prep.scheduled",
        {"order_id": str(order.id), "prep_minutes": 0},
    )
    assert res_b1["status"] == "broadcasted"
    b1_offers = DeliveryOffer.objects.filter(order=order, batch_number=1)
    assert b1_offers.filter(driver=driver1).exists()

    # Batch 1 times out -> driver1 marked TIMED_OUT & excluded from Batch 2
    res_timeout = _invoke_inngest(
        fn_driver_offer_timeout_handler,
        "delivery/offers.broadcasted",
        {"order_id": str(order.id), "batch": 1, "timeout_seconds": 45},
    )
    assert res_timeout["status"] == "re_broadcasted"
    assert res_timeout["batch"] == 2

    b1_offer_d1 = DeliveryOffer.objects.get(order=order, driver=driver1, batch_number=1)
    assert b1_offer_d1.status == DeliveryOffer.Status.TIMED_OUT

    b2_offers = DeliveryOffer.objects.filter(order=order, batch_number=2)
    assert not b2_offers.filter(driver=driver1).exists(), "Timed-out Batch 1 driver must be excluded from Batch 2"
    assert b2_offers.filter(driver=driver2).exists()

    # Driver 2 accepts Batch 2 offer
    b2_offer_d2 = b2_offers.get(driver=driver2)
    ok, trip = accept_delivery_offer(b2_offer_d2.id, driver2)
    assert ok is True
    assert isinstance(trip, DeliveryTrip)
    assert trip.driver == driver2


@pytest.mark.django_db
def test_t3_06_driver_decline_radius_escalation_10km_and_selection(order_factory, restaurant, mock_centrifugo):
    """Pair 6: Driver Offer Decline (5km) + Radius Escalation to 10km + Candidate Driver Selection."""
    near_driver = _make_driver("drv_near", lat=24.7140, lon=46.6755)
    far_driver = _make_driver("drv_far_8km", lat=24.7850, lon=46.6753)  # ~7.9 km north of restaurant
    order = order_factory(status=Order.Status.PREPARING, restaurant_instance=restaurant)

    # Batch 1 within 5km only matches near_driver
    cands_5km = find_candidate_drivers(order, radius_km=5.0, limit=3)
    assert [d.id for d, _ in cands_5km] == [near_driver.id]

    offers = broadcast_delivery_offers(order, cands_5km, batch_number=1)
    ok, _ = reject_delivery_offer(offers[0].id, near_driver)
    assert ok is True

    # Escalate to 10km -> near_driver excluded, far_driver selected
    cands_10km = find_candidate_drivers(order, radius_km=10.0, limit=4)
    cand_ids = [d.id for d, _ in cands_10km]
    assert near_driver.id not in cand_ids
    assert far_driver.id in cand_ids


@pytest.mark.django_db
def test_t3_07_concurrent_offer_acceptance_lock_and_manual_dispatch_alert(
    order_factory,
    restaurant,
    authenticated_client,
    mock_centrifugo,
    mock_inngest,
):
    """Pair 7: Concurrency Lock on Offer Acceptance + Supervisor Manual Re-dispatch Alert."""
    d1 = _make_driver("drv_race_1", lat=24.7137, lon=46.6754)
    d2 = _make_driver("drv_race_2", lat=24.7138, lon=46.6755)
    order = order_factory(status=Order.Status.PREPARING, restaurant_instance=restaurant)

    offers = broadcast_delivery_offers(order, [(d1, 0.2), (d2, 0.3)], batch_number=1)
    client_d1 = authenticated_client(d1)
    client_d2 = authenticated_client(d2)

    r1 = client_d1.post(f"/api/v1/driver/offers/{offers[0].id}/accept/", {}, format="json")
    r2 = client_d2.post(f"/api/v1/driver/offers/{offers[1].id}/accept/", {}, format="json")

    assert r1.status_code == status.HTTP_200_OK
    assert r2.status_code == status.HTTP_409_CONFLICT
    assert DeliveryTrip.objects.filter(order=order).count() == 1
    offers[1].refresh_from_db()
    assert offers[1].status == DeliveryOffer.Status.EXPIRED

    # Second order with zero available drivers triggers supervisor manual dispatch alert
    order_no_drv = order_factory(status=Order.Status.PREPARING, restaurant_instance=restaurant)
    d1.driver_profile.is_online = False
    d1.driver_profile.save()
    d2.driver_profile.is_online = False
    d2.driver_profile.save()
    mock_centrifugo.clear()

    res_alert = _invoke_inngest(
        fn_order_auto_dispatch_flow,
        "order/prep.scheduled",
        {"order_id": str(order_no_drv.id), "prep_minutes": 0},
    )
    assert res_alert["status"] == "no_candidates"
    assert len(mock_centrifugo.events) >= 1


@pytest.mark.django_db
def test_t3_08_store_own_fleet_double_commission_prevention_and_transitions(
    auth_merchant_client,
    merchant_user,
    egp_currency,
    order_factory,
    mock_centrifugo,
):
    """Pair 8: Store-Own-Fleet Order + Double Commission Prevention (is_commission_deducted) + Status Transition."""
    store = Restaurant.objects.create(
        owner=merchant_user,
        name="مطعم الأسطول الخاص",
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=egp_currency,
        latitude=24.713600,
        longitude=46.675300,
    )
    merchant_wallet, _ = Wallet.objects.get_or_create(
        user=merchant_user,
        defaults={"balance": Decimal("500.00"), "currency": "EGP"},
    )
    merchant_wallet.balance = Decimal("500.00")
    merchant_wallet.save()

    order = order_factory(
        restaurant_instance=store,
        status=Order.Status.CONFIRMED,
        payment_method=Order.PaymentMethod.COD,
        items=[{"unit_price": Decimal("100.00"), "quantity": 2}],  # subtotal = 200.00
    )

    # First transition to DELIVERED deducts 15% commission = 30.00
    res1 = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/status/",
        {"status": Order.Status.DELIVERED},
        format="json",
    )
    assert res1.status_code == status.HTTP_200_OK
    merchant_wallet.refresh_from_db()
    assert merchant_wallet.balance == Decimal("470.00")

    # Repeated transition to DELIVERED must NOT deduct commission a second time
    res2 = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/status/",
        {"status": Order.Status.DELIVERED},
        format="json",
    )
    assert res2.status_code == status.HTTP_200_OK
    merchant_wallet.refresh_from_db()
    assert merchant_wallet.balance == Decimal("470.00"), "Duplicate commission deduction occurred on repeated DELIVERED!"


@pytest.mark.django_db
def test_t3_09_platform_fleet_commission_and_weekly_inngest_payout(
    order_factory,
    restaurant,
):
    """Pair 9: Platform Fleet Prepaid Order + Commission Extraction + Weekly Inngest Payout Job."""
    order = order_factory(
        restaurant_instance=restaurant,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.CARD,
        payment_status=Order.PaymentStatus.PAID,
        items=[{"unit_price": Decimal("100.00"), "quantity": 3}],  # subtotal = 300.00
    )
    last_week = timezone.now() - datetime.timedelta(days=3)
    Order.objects.filter(id=order.id).update(created_at=last_week)

    res = _invoke_inngest(fn_weekly_vendor_payouts_cron, "inngest/cron", {})
    assert res["settled_restaurants"] >= 1

    payout = VendorPayout.objects.get(restaurant=restaurant)
    assert payout.gross_sales == Decimal("300.00")
    assert payout.commission_amount == Decimal("45.00")
    assert payout.net_payout == Decimal("255.00")


@pytest.mark.django_db
def test_t3_10_cod_order_excluded_from_vendor_payout_disbursement(
    order_factory,
    restaurant,
):
    """Pair 10: COD Order + Vendor Payout Execution (COD sales excluded from vendor cash disbursement)."""
    card_order = order_factory(
        restaurant_instance=restaurant,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.CARD,
        payment_status=Order.PaymentStatus.PAID,
        items=[{"unit_price": Decimal("200.00"), "quantity": 1}],  # 200.00
    )
    cod_order = order_factory(
        restaurant_instance=restaurant,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.COD,
        payment_status=Order.PaymentStatus.PAID,
        items=[{"unit_price": Decimal("400.00"), "quantity": 1}],  # 400.00 COD
    )
    last_week = timezone.now() - datetime.timedelta(days=3)
    Order.objects.filter(id__in=[card_order.id, cod_order.id]).update(created_at=last_week)

    _invoke_inngest(fn_weekly_vendor_payouts_cron, "inngest/cron", {})

    payout = VendorPayout.objects.get(restaurant=restaurant)
    # Vendor already collected (or owes commission on) COD; COD revenue must NOT be disbursed as net_payout
    assert payout.net_payout <= Decimal("170.00"), (
        f"COD sales were wrongly included in vendor payout disbursement: net_payout={payout.net_payout}"
    )


# ============================================================================
# T3-11 to T3-20: Driver Wallet, Settlement Cap, Contactless POD, Search & JWT Pairs
# ============================================================================


@pytest.mark.django_db
def test_t3_11_driver_shift_settlement_handover_and_supervisor_daily_cap(
    auth_driver_client,
    auth_supervisor_client,
    authenticated_client,
    driver_user,
    restaurant,
    order_factory,
    shift_settlement_factory,
):
    """Pair 11: Driver Shift Settlement Cash Handover + Supervisor Daily Cumulative Cap."""
    PlatformSetting.objects.update_or_create(pk=1, defaults={"supervisor_max_settlement_limit": Decimal("500.00")})
    driver_user.driver_profile.cash_in_hand = Decimal("900.00")
    driver_user.driver_profile.save()

    cod_order = order_factory(
        restaurant_instance=restaurant,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.COD,
        items=[{"unit_price": Decimal("250.00"), "quantity": 1}],
    )
    settlement = shift_settlement_factory(
        restaurant_instance=restaurant,
        driver=driver_user,
        orders=[cod_order],
        total_goods_amount=Decimal("250.00"),
        platform_commission_amount=Decimal("37.50"),
    )

    # Driver completes merchant handover OTP -> reduces cash_in_hand from 900 to 650
    otp_res = auth_driver_client.post(
        "/api/v1/driver/settlement/verify-otp/",
        {"otp_code": settlement.otp_code, "settlement_id": str(settlement.id)},
        format="json",
    )
    assert otp_res.status_code == status.HTTP_200_OK
    driver_user.driver_profile.refresh_from_db()
    assert driver_user.driver_profile.cash_in_hand == Decimal("650.00")

    # Standard SUPERVISOR (not OPS_MANAGER) settles 400 (approved), then 200 (cumulative 600 > 500 cap -> pending)
    sup_user = User.objects.create_user(
        username=f"sup_cap_{uuid.uuid4().hex[:5]}",
        password="password123",
        role=User.Roles.SUPERVISOR,
        is_staff=True,
    )
    sup_client = authenticated_client(sup_user)

    r1 = sup_client.post(
        "/api/v1/supervisor/cash/settle/",
        {"driver_id": str(driver_user.id), "amount": "400.00"},
        format="json",
    )
    assert r1.status_code == status.HTTP_200_OK
    assert r1.data["status"] == "APPROVED"

    r2 = sup_client.post(
        "/api/v1/supervisor/cash/settle/",
        {"driver_id": str(driver_user.id), "amount": "200.00"},
        format="json",
    )
    assert r2.status_code == status.HTTP_200_OK
    assert r2.data["status"] == "PENDING_APPROVAL"


@pytest.mark.django_db
def test_t3_12_driver_payout_request_api_balance_and_inngest_payout(
    auth_driver_client,
    driver_user,
    driver_wallet,
):
    """Pair 12: Driver Payout Request via Live API + Balance Check + Transaction Ledger."""
    # Driver wallet starts at 500.00 EGP
    res_payout = auth_driver_client.post(
        "/api/v1/driver/wallet/payout-request/",
        {"amount": "200.00", "note": "سحب أرباح الأسبوع"},
        format="json",
    )
    assert res_payout.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    driver_wallet.refresh_from_db()
    assert driver_wallet.balance == Decimal("300.00")

    # Attempting payout above remaining balance (400 > 300) must fail
    res_over = auth_driver_client.post(
        "/api/v1/driver/wallet/payout-request/",
        {"amount": "400.00", "note": "تجاوز الرصيد"},
        format="json",
    )
    assert res_over.status_code == status.HTTP_400_BAD_REQUEST

    tx_res = auth_driver_client.get("/api/v1/driver/wallet/transactions/")
    assert tx_res.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_t3_13_contactless_delivery_photo_upload_and_centrifugo_broadcast(
    auth_driver_client,
    driver_user,
    order_factory,
    mock_centrifugo,
):
    """Pair 13: Contactless Delivery Flag + POD Photo Required + Centrifugo Order Delivered Broadcast."""
    order = order_factory(status=Order.Status.ON_THE_WAY, payment_method=Order.PaymentMethod.WALLET)
    trip = DeliveryTrip.objects.create(
        order=order,
        driver=driver_user,
        status=DeliveryTrip.Status.PICKED_UP,
        driver_earnings=Decimal("12.00"),
    )

    # Without photo upload, contactless completion must be rejected
    res_no_photo = auth_driver_client.post(
        f"/api/v1/driver/trips/{trip.id}/verify-otp/",
        {"is_contactless": True, "note": "ترك عند الباب"},
        format="json",
    )
    assert res_no_photo.status_code == status.HTTP_400_BAD_REQUEST

    # With valid POD photo upload, contactless completion succeeds and broadcasts on orders:order_{id}
    mock_centrifugo.clear()
    res_with_photo = auth_driver_client.post(
        f"/api/v1/driver/trips/{trip.id}/verify-otp/",
        {"is_contactless": "true", "note": "تم الترك عند الباب", "proof_photo": _make_image_upload()},
        format="multipart",
    )
    assert res_with_photo.status_code == status.HTTP_200_OK

    order.refresh_from_db()
    assert order.status == Order.Status.DELIVERED
    mock_centrifugo.assert_published(channel=f"orders:order_{order.id}")


@pytest.mark.django_db
def test_t3_14_store_listing_meilisearch_outage_db_fallback_and_distance_sort(
    api_client,
    merchant_user,
    egp_currency,
):
    """Pair 14: Search Query + Meilisearch Outage + Database Fallback + Distance Sorting."""
    near_store = Restaurant.objects.create(
        owner=merchant_user,
        name="سوبرماركت قريب فوكس",
        store_type=Restaurant.StoreType.SUPERMARKET,
        currency=egp_currency,
        latitude=Decimal("24.714000"),
        longitude=Decimal("46.675500"),
        delivery_radius_km=20.0,
        is_active=True,
    )
    far_store = Restaurant.objects.create(
        owner=merchant_user,
        name="سوبرماركت بعيد فوكس",
        store_type=Restaurant.StoreType.SUPERMARKET,
        currency=egp_currency,
        latitude=Decimal("24.770000"),
        longitude=Decimal("46.720000"),
        delivery_radius_km=20.0,
        is_active=True,
    )
    cat_near = MenuCategory.objects.create(restaurant=near_store, name="ألبان")
    MenuItem.objects.create(category=cat_near, name="حليب طازج فوكس", base_price=Decimal("15.00"), is_available=True)

    # Simulate Meilisearch outage
    with patch("apps.menus.meilisearch_service.get_meili_client", side_effect=ConnectionError("Meilisearch down")):
        res = api_client.get("/api/v1/customer/search/?q=فوكس&lat=24.7136&lng=46.6753")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["total_stores"] >= 2
        returned_ids = [s["id"] for s in res.data["stores"]]
        assert returned_ids.index(str(near_store.id)) < returned_ids.index(str(far_store.id))
        assert res.data["total_products"] >= 1


@pytest.mark.django_db
def test_t3_15_register_role_fix_wallet_topup_limit_and_order_creation(
    api_client,
    restaurant,
    menu_item,
):
    """Pair 15: Registration Role Fix (CUSTOMER) + Bounded Wallet Top-Up + Immediate Order Creation."""
    uid = uuid.uuid4().hex[:6]
    reg_res = api_client.post(
        "/api/v1/auth/register/",
        {
            "username": f"buyer_{uid}",
            "password": "Password123!",
            "first_name": "سارة",
            "last_name": "حسن",
            "phone_number": f"+2010{uid[:8].ljust(8, '1')}",
            "role": "ADMIN",  # Attempt mass assignment escalation
        },
        format="json",
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    user = User.objects.get(username=f"buyer_{uid}")
    assert user.role == User.Roles.CUSTOMER

    client = APIClient()
    client.force_authenticate(user=user)
    addr = Address.objects.create(
        user=user, title="البيت", street="التحرير", latitude=24.714000, longitude=46.675500, is_default=True
    )

    # Top-up wallet with valid amount
    topup_res = client.post("/api/v1/customer/payments/wallet/topup/", {"amount": "300.00"}, format="json")
    assert topup_res.status_code == status.HTTP_200_OK

    # Immediately create WALLET order
    order_res = client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(addr.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
        },
        format="json",
    )
    assert order_res.status_code == status.HTTP_201_CREATED
    wallet = Wallet.objects.get(user=user)
    assert wallet.balance == Decimal("300.00") - Decimal(str(order_res.data["total_amount"]))


@pytest.mark.django_db
def test_t3_16_expired_jwt_token_refresh_and_replayed_request(
    api_client,
    customer_user,
    customer_wallet,
):
    """Pair 16: Expired JWT Access Token -> 401 -> Refresh Token -> Replayed Authenticated Request."""
    refresh = RefreshToken.for_user(customer_user)
    expired_access = refresh.access_token
    expired_access.set_exp(lifetime=-datetime.timedelta(minutes=5))

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(expired_access)}")
    r_expired = api_client.get("/api/v1/customer/payments/wallet/")
    assert r_expired.status_code == status.HTTP_401_UNAUTHORIZED

    # Refresh token endpoint
    r_refresh = api_client.post(
        "/api/v1/auth/token/refresh/",
        {"refresh": str(refresh)},
        format="json",
    )
    assert r_refresh.status_code == status.HTTP_200_OK
    new_access = r_refresh.data["access"]

    # Replay original request with refreshed access token
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access}")
    r_replay = api_client.get("/api/v1/customer/payments/wallet/")
    assert r_replay.status_code == status.HTTP_200_OK
    assert Decimal(str(r_replay.data["balance"])) == Decimal("1000.00")


@pytest.mark.django_db
def test_t3_17_centrifugo_order_channel_and_confirm_weights_payload(
    auth_customer_client,
    auth_merchant_client,
    order_factory,
    weighted_menu_item,
    mock_centrifugo,
):
    """Pair 17: Centrifugo orders:order_{id} Subscription Token + Confirm Weights Event Payload."""
    token_res = auth_customer_client.get("/api/v1/realtime/token/")
    assert token_res.status_code == status.HTTP_200_OK
    assert "token" in token_res.data

    order = order_factory(
        payment_method=Order.PaymentMethod.CARD,
        status=Order.Status.PREPARING,
        items=[{
            "menu_item": weighted_menu_item,
            "quantity": 1,
            "unit_price": Decimal("120.00"),
            "is_weighted": True,
            "requested_weight": Decimal("1.000"),
        }],
    )
    item = order.items.first()
    mock_centrifugo.clear()

    res = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order.id}/confirm-weights/",
        {"items": [{"item_id": str(item.id), "actual_weight": "1.250"}]},
        format="json",
    )
    assert res.status_code == status.HTTP_200_OK

    channel = f"orders:order_{order.id}"
    events = mock_centrifugo.filter(channel=channel)
    assert len(events) >= 1
    ev = events[-1]
    assert ev.channel == channel
    assert ev.payload.get("is_weight_confirmed") is True
    assert Decimal(str(ev.payload.get("subtotal"))) == Decimal("150.00")


@pytest.mark.django_db
def test_t3_18_driver_high_freq_gps_redis_geo_and_write_behind_pg(
    auth_driver_client,
    driver_user,
    order_factory,
    mock_redis_geo,
    mock_centrifugo,
):
    """Pair 18: High-Frequency Driver GPS Updates -> Redis GEOADD + Write-Behind Throttled PostgreSQL."""
    order = order_factory(status=Order.Status.ON_THE_WAY)
    DeliveryTrip.objects.create(order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP)

    coords_sequence = [
        (24.714000, 46.675500),
        (24.714100, 46.675600),
        (24.714200, 46.675700),
        (24.714300, 46.675800),
        (24.714400, 46.675900),
    ]
    for lat, lon in coords_sequence:
        res = auth_driver_client.post(
            "/api/v1/driver/gps/",
            {"latitude": lat, "longitude": lon, "heading": 45.0, "speed": 30.0},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK

    # Redis GEO must reflect the latest position immediately
    latest_geo = mock_redis_geo.get_driver_coords(driver_user.id)
    assert latest_geo == (46.6759, 24.7144)
    pos_cache = mock_redis_geo.get_driver_pos_cache(driver_user.id)
    assert pos_cache["latitude"] == 24.7144
    assert pos_cache["longitude"] == 46.6759

    # Centrifugo location broadcast must use unified orders:order_{id} channel
    assert mock_centrifugo.has_event(channel=f"orders:order_{order.id}")


@pytest.mark.django_db
def test_t3_19_supervisor_operations_broadcast_and_alert_event(
    auth_supervisor_client,
    driver_user,
    order_factory,
    mock_centrifugo,
):
    """Pair 19: Supervisor Operations Broadcast on supervisor:operations + Audit Log."""
    order = order_factory(status=Order.Status.READY_FOR_PICKUP)
    mock_centrifugo.clear()

    res = auth_supervisor_client.post(
        "/api/v1/supervisor/dispatch/assign/",
        {"order_id": str(order.id), "driver_id": str(driver_user.id), "mode": "direct"},
        format="json",
    )
    assert res.status_code == status.HTTP_200_OK

    assert mock_centrifugo.has_event(channel="supervisor:operations")
    assert mock_centrifugo.has_event(channel=f"orders:order_{order.id}")


@pytest.mark.django_db
def test_t3_20_multiple_split_settlements_under_supervisor_daily_cap(
    authenticated_client,
    driver_user,
):
    """Pair 20: Split Cash Settlements under Supervisor Cap -> Cumulative Cap Enforcement."""
    PlatformSetting.objects.update_or_create(pk=1, defaults={"supervisor_max_settlement_limit": Decimal("500.00")})
    driver_user.driver_profile.cash_in_hand = Decimal("800.00")
    driver_user.driver_profile.save()

    sup = User.objects.create_user(
        username=f"sup_split_{uuid.uuid4().hex[:5]}",
        password="password123",
        role=User.Roles.SUPERVISOR,
        is_staff=True,
    )
    sup_client = authenticated_client(sup)

    # Split 1: 300.00 (cumulative 300 <= 500) -> APPROVED
    r1 = sup_client.post("/api/v1/supervisor/cash/settle/", {"driver_id": str(driver_user.id), "amount": "300.00"}, format="json")
    assert r1.status_code == status.HTTP_200_OK
    assert r1.data["status"] == "APPROVED"

    # Split 2: 200.00 (cumulative 500 <= 500) -> APPROVED
    r2 = sup_client.post("/api/v1/supervisor/cash/settle/", {"driver_id": str(driver_user.id), "amount": "200.00"}, format="json")
    assert r2.status_code == status.HTTP_200_OK
    assert r2.data["status"] == "APPROVED"

    # Split 3: 50.00 (cumulative 550 > 500 daily cap) -> must require approval (PENDING_APPROVAL)
    r3 = sup_client.post("/api/v1/supervisor/cash/settle/", {"driver_id": str(driver_user.id), "amount": "50.00"}, format="json")
    assert r3.status_code == status.HTTP_200_OK
    assert r3.data["status"] == "PENDING_APPROVAL"


# ============================================================================
# T3-21 to T3-34: Additional High-Value Cross-Feature Pairwise Interactions
# ============================================================================


@pytest.mark.django_db
def test_t3_21_wallet_nsf_order_blocked_and_topup_exceeding_cap_rejected(
    auth_customer_client,
    zero_balance_wallet,
    restaurant,
    customer_address,
    menu_item,
):
    """Pair 21: NSF Wallet Order Blocked + Unconstrained Huge Top-Up Rejected."""
    order_res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "items": [{"menu_item_id": str(menu_item.id), "quantity": 2}],
        },
        format="json",
    )
    assert order_res.status_code == status.HTTP_400_BAD_REQUEST

    # Unconstrained simulated top-up (e.g. 1,000,000) must be rejected
    huge_topup = auth_customer_client.post(
        "/api/v1/customer/payments/wallet/topup/",
        {"amount": "1000000.00"},
        format="json",
    )
    assert huge_topup.status_code == status.HTTP_400_BAD_REQUEST
    zero_balance_wallet.refresh_from_db()
    assert zero_balance_wallet.balance == Decimal("0.00")


@pytest.mark.django_db
def test_t3_22_card_weighted_item_actual_weight_under_vs_over_requested(
    auth_merchant_client,
    order_factory,
    weighted_menu_item,
    mock_centrifugo,
):
    """Pair 22: Variable Weight Actual < Requested (Partial Release) vs Actual > Requested (Within Hold)."""
    # Case A: Actual weight LOWER than requested (1.0 KG vs 2.0 KG)
    order_low = order_factory(
        payment_method=Order.PaymentMethod.CARD,
        status=Order.Status.PREPARING,
        delivery_fee=Decimal("10.00"),
        items=[{
            "menu_item": weighted_menu_item,
            "quantity": 1,
            "unit_price": Decimal("100.00"),
            "is_weighted": True,
            "requested_weight": Decimal("2.000"),
        }],
    )
    # 200 + 10 + 30 hold = 240
    assert order_low.total_amount == Decimal("240.00")
    r_low = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order_low.id}/confirm-weights/",
        {"items": [{"item_id": str(order_low.items.first().id), "actual_weight": "1.000"}]},
        format="json",
    )
    assert r_low.status_code == status.HTTP_200_OK
    order_low.refresh_from_db()
    assert order_low.total_amount == Decimal("110.00")
    assert order_low.preauth_hold_amount == Decimal("0.00")

    # Case B: Actual weight HIGHER within 15% hold (2.2 KG vs 2.0 KG)
    order_high = order_factory(
        payment_method=Order.PaymentMethod.CARD,
        status=Order.Status.PREPARING,
        delivery_fee=Decimal("10.00"),
        items=[{
            "menu_item": weighted_menu_item,
            "quantity": 1,
            "unit_price": Decimal("100.00"),
            "is_weighted": True,
            "requested_weight": Decimal("2.000"),
        }],
    )
    r_high = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order_high.id}/confirm-weights/",
        {"items": [{"item_id": str(order_high.items.first().id), "actual_weight": "2.200"}]},
        format="json",
    )
    assert r_high.status_code == status.HTTP_200_OK
    order_high.refresh_from_db()
    assert order_high.total_amount == Decimal("230.00")
    assert order_high.preauth_hold_amount == Decimal("0.00")


@pytest.mark.django_db
def test_t3_23_merchant_rejects_wallet_order_refund_and_coupon_restore(
    auth_customer_client,
    auth_merchant_client,
    customer_user,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
    mock_centrifugo,
):
    """Pair 23: Merchant Rejects WALLET Order -> Atomic Wallet Refund + Coupon Restoration + Centrifugo."""
    coupon = Coupon.objects.create(
        code=f"MERCH_{uuid.uuid4().hex[:4].upper()}",
        discount_type=Coupon.DiscountTypes.PERCENT,
        discount_value=Decimal("10.00"),
        valid_from=timezone.now() - datetime.timedelta(days=1),
        valid_to=timezone.now() + datetime.timedelta(days=5),
        is_active=True,
    )
    res = auth_customer_client.post(
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
    assert res.status_code == status.HTTP_201_CREATED
    order_id = res.data["id"]

    # Merchant rejects order
    rej_res = auth_merchant_client.post(
        f"/api/v1/merchant/orders/{order_id}/status/",
        {"status": Order.Status.CANCELLED, "reason": "المتجر مزدحم"},
        format="json",
    )
    assert rej_res.status_code == status.HTTP_200_OK

    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == Decimal("1000.00")
    assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0
    mock_centrifugo.assert_published(channel=f"orders:order_{order_id}")


@pytest.mark.django_db
def test_t3_24_inngest_prep_sleep_wake_after_cancel_aborts_dispatch(
    order_factory,
    restaurant,
    mock_centrifugo,
):
    """Pair 24: Inngest Prep Sleep -> Cancel Before Wake -> Inngest Aborts Dispatch."""
    _make_driver("drv_avail", lat=24.7137, lon=46.6754)
    order = order_factory(status=Order.Status.CONFIRMED, restaurant_instance=restaurant)

    def _cancel_mid_sleep(step_id, duration):
        order.transition_to(Order.Status.CANCELLED, note="Cancelled mid-sleep")

    res = _invoke_inngest(
        fn_order_auto_dispatch_flow,
        "order/prep.scheduled",
        {"order_id": str(order.id), "prep_minutes": 10},
        on_sleep=_cancel_mid_sleep,
    )
    assert DeliveryOffer.objects.filter(order=order).count() == 0
    assert res.get("status") in ("cancelled", "order_cancelled", "aborted")


@pytest.mark.django_db
def test_t3_25_driver_cash_deposit_api_reduces_debt_and_updates_ledger(
    auth_driver_client,
    driver_user,
    driver_wallet,
):
    """Pair 25: Driver Cash Deposit API -> Reduces cash_in_hand & Records Transaction Ledger."""
    driver_user.driver_profile.cash_in_hand = Decimal("400.00")
    driver_user.driver_profile.save()

    res = auth_driver_client.post(
        "/api/v1/driver/wallet/cash-deposit/",
        {"amount": "250.00", "reference_number": "DEP-INSTAPAY-9981"},
        format="json",
    )
    assert res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    driver_user.driver_profile.refresh_from_db()
    assert driver_user.driver_profile.cash_in_hand == Decimal("150.00")

    tx_res = auth_driver_client.get("/api/v1/driver/wallet/transactions/")
    assert tx_res.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_t3_26_delivery_zone_reconciliation_with_dynamic_fee_and_surge(
    auth_customer_client,
    merchant_user,
    egp_currency,
    customer_address,
    menu_item,
):
    """Pair 26: Reconciled DeliveryZone + Surge Pricing + Order Dynamic Fee & Zone Audit."""
    store_zone = StoreDeliveryZone.objects.create(
        name="زون العليا الموحد",
        city="الرياض",
        currency=egp_currency,
        base_delivery_fee=Decimal("15.00"),
        base_distance_km=Decimal("3.00"),
        per_km_fee=Decimal("2.00"),
        max_delivery_fee=Decimal("50.00"),
        is_manual_surge_active=True,
        manual_surge_percent=Decimal("20.00"),
        polygon_coordinates=[
            [24.65, 46.60],
            [24.65, 46.75],
            [24.80, 46.75],
            [24.80, 46.60],
        ],
        is_active=True,
    )
    store = Restaurant.objects.create(
        owner=merchant_user,
        name="متجر الزون الموحد",
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
        delivery_fee=Decimal("15.00"),
    )
    store.delivery_zones.add(store_zone)
    cat = MenuCategory.objects.create(restaurant=store, name="مشروبات")
    item = MenuItem.objects.create(category=cat, name="عصير برتقال", base_price=Decimal("40.00"), is_available=True)

    res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(store.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.COD,
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )
    assert res.status_code == status.HTTP_201_CREATED
    order = Order.objects.get(id=res.data["id"])
    assert order.delivery_zone == store_zone
    assert order.is_surge_applied is True
    assert order.surge_percent >= Decimal("20.00")
    assert order.delivery_fee == Decimal("18.00")  # 15.00 * 1.20


@pytest.mark.django_db
def test_t3_27_driver_over_cod_ceiling_excluded_from_dispatch_until_settled(
    auth_supervisor_client,
    order_factory,
    restaurant,
):
    """Pair 27: Driver Over COD Ceiling Excluded from Dispatch -> Settled by Supervisor -> Re-eligible."""
    PlatformSetting.objects.update_or_create(pk=1, defaults={"cod_max_ceiling": Decimal("500.00")})
    over_driver = _make_driver("drv_over", lat=24.7137, lon=46.6754, cash_in_hand=Decimal("650.00"))
    order = order_factory(status=Order.Status.PREPARING, restaurant_instance=restaurant)

    # Excluded while over COD ceiling
    assert find_candidate_drivers(order, radius_km=5.0) == []

    # Supervisor settles 200.00 -> cash_in_hand drops to 450.00 <= 500.00
    res_settle = auth_supervisor_client.post(
        "/api/v1/supervisor/cash/settle/",
        {"driver_id": str(over_driver.id), "amount": "200.00"},
        format="json",
    )
    assert res_settle.status_code == status.HTTP_200_OK

    cands = find_candidate_drivers(order, radius_km=5.0)
    assert [d.id for d, _ in cands] == [over_driver.id]


@pytest.mark.django_db
def test_t3_28_store_own_fleet_skips_inngest_dispatch_and_allows_merchant_delivery(
    auth_merchant_client,
    merchant_user,
    egp_currency,
    order_factory,
    mock_inngest,
):
    """Pair 28: STORE_OWN_FLEET Skips Inngest Dispatch + Merchant Progresses ON_THE_WAY -> DELIVERED."""
    store = Restaurant.objects.create(
        owner=merchant_user,
        name="مطعم التوصيل الذاتي",
        delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET,
        currency=egp_currency,
        latitude=Decimal("24.713600"),
        longitude=Decimal("46.675300"),
    )
    order = order_factory(restaurant_instance=store, status=Order.Status.PENDING, payment_method=Order.PaymentMethod.COD)

    for st in [Order.Status.CONFIRMED, Order.Status.PREPARING, Order.Status.ON_THE_WAY, Order.Status.DELIVERED]:
        r = auth_merchant_client.post(
            f"/api/v1/merchant/orders/{order.id}/status/",
            {"status": st},
            format="json",
        )
        assert r.status_code == status.HTTP_200_OK

    assert not mock_inngest.has_event(name="order/prep.scheduled")
    order.refresh_from_db()
    assert order.status == Order.Status.DELIVERED


@pytest.mark.django_db
def test_t3_29_sequential_collision_free_order_numbers_under_bulk_creation(order_factory):
    """Pair 29: Collision-Free Order Numbers Across Bulk Creation."""
    numbers = []
    for _ in range(25):
        o = order_factory(status=Order.Status.PENDING)
        numbers.append(o.order_number)

    assert len(set(numbers)) == 25
    # High-entropy or sequential scheme must not rely on short 6-digit random (length > 10 or strict monotonic sequence)
    for num in numbers:
        assert num.startswith("FOX-")
        suffix = num.split("-", 1)[1]
        assert len(suffix) >= 8 or suffix.isdigit()


@pytest.mark.django_db
def test_t3_30_shift_settlement_otp_prevents_double_payout_deduction(
    auth_driver_client,
    driver_user,
    restaurant,
    order_factory,
    shift_settlement_factory,
):
    """Pair 30: Driver ShiftSettlement Handover Verified -> Weekly Payout Prevents Double COD Deduction."""
    driver_user.driver_profile.cash_in_hand = Decimal("300.00")
    driver_user.driver_profile.save()

    cod_order = order_factory(
        restaurant_instance=restaurant,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.COD,
        delivery_fee=Decimal("20.00"),
        items=[{"unit_price": Decimal("280.00"), "quantity": 1}],
    )
    trip = DeliveryTrip.objects.create(
        order=cod_order,
        driver=driver_user,
        status=DeliveryTrip.Status.COMPLETED,
        driver_earnings=Decimal("16.00"),
        completed_at=timezone.now() - datetime.timedelta(days=3),
    )
    Order.objects.filter(id=cod_order.id).update(created_at=timezone.now() - datetime.timedelta(days=3))

    settlement = shift_settlement_factory(
        restaurant_instance=restaurant,
        driver=driver_user,
        orders=[cod_order],
        total_goods_amount=Decimal("280.00"),
        platform_commission_amount=Decimal("42.00"),
    )
    otp_res = auth_driver_client.post(
        "/api/v1/driver/settlement/verify-otp/",
        {"otp_code": settlement.otp_code},
        format="json",
    )
    assert otp_res.status_code == status.HTTP_200_OK

    # Run weekly payouts -> driver handed over COD to merchant via ShiftSettlement so must NOT be double-debited!
    from apps.payments.models import DriverPayout
    _invoke_inngest(fn_weekly_vendor_payouts_cron, "inngest/cron", {})
    dp = DriverPayout.objects.filter(driver=driver_user).first()
    if dp is not None:
        assert dp.net_balance >= Decimal("0.00"), (
            f"Driver double-debited for COD already handed over via ShiftSettlement: net_balance={dp.net_balance}"
        )


@pytest.mark.django_db
def test_t3_31_ops_manager_approves_flagged_settlement_and_logs_audit(
    authenticated_client,
    auth_supervisor_client,
    driver_user,
    mock_centrifugo,
):
    """Pair 31: Flagged Cash Settlement -> Ops Manager Approval -> Audit Log & Centrifugo Notification."""
    PlatformSetting.objects.update_or_create(pk=1, defaults={"supervisor_max_settlement_limit": Decimal("500.00")})
    driver_user.driver_profile.cash_in_hand = Decimal("750.00")
    driver_user.driver_profile.save()

    sup = User.objects.create_user(
        username=f"sup_flag_{uuid.uuid4().hex[:5]}",
        password="password123",
        role=User.Roles.SUPERVISOR,
        is_staff=True,
    )
    sup_client = authenticated_client(sup)

    r_flag = sup_client.post(
        "/api/v1/supervisor/cash/settle/",
        {"driver_id": str(driver_user.id), "amount": "700.00"},
        format="json",
    )
    assert r_flag.status_code == status.HTTP_200_OK
    assert r_flag.data["status"] == "PENDING_APPROVAL"
    settlement_id = r_flag.data["settlement_id"]

    # Ops manager approves via /ops/approvals/<id>/
    r_approve = auth_supervisor_client.post(
        f"/api/v1/supervisor/ops/approvals/{settlement_id}/",
        {"action": "approve"},
        format="json",
    )
    assert r_approve.status_code == status.HTTP_200_OK
    driver_user.driver_profile.refresh_from_db()
    assert driver_user.driver_profile.cash_in_hand == Decimal("50.00")
    assert SupervisorActionLog.objects.filter(
        action_type=SupervisorActionLog.ActionType.CASH_APPROVED,
        target_id=settlement_id,
    ).exists()


@pytest.mark.django_db
def test_t3_32_multi_sector_mixed_cart_wallet_and_coupon_discount(
    auth_customer_client,
    customer_user,
    customer_wallet,
    restaurant,
    customer_address,
    menu_item,
    weighted_menu_item,
):
    """Pair 32: Mixed Standard + Weighted Cart + Percent Coupon + Atomic Wallet Payment."""
    coupon = Coupon.objects.create(
        code=f"MIX10_{uuid.uuid4().hex[:4].upper()}",
        discount_type=Coupon.DiscountTypes.PERCENT,
        discount_value=Decimal("10.00"),
        valid_from=timezone.now() - datetime.timedelta(days=1),
        valid_to=timezone.now() + datetime.timedelta(days=5),
        is_active=True,
    )
    # menu_item=45.00 x 2 = 90.00; weighted_menu_item=120.00 x 1.5 KG = 180.00; subtotal = 270.00
    # 10% coupon = 27.00; delivery = 12.00; total = 270 + 12 - 27 = 255.00
    res = auth_customer_client.post(
        "/api/v1/customer/orders/checkout/",
        {
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(customer_address.id),
            "payment_method": Order.PaymentMethod.WALLET,
            "coupon_code": coupon.code,
            "items": [
                {"menu_item_id": str(menu_item.id), "quantity": 2},
                {"menu_item_id": str(weighted_menu_item.id), "quantity": 1, "requested_weight": "1.500"},
            ],
        },
        format="json",
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert Decimal(str(res.data["subtotal"])) == Decimal("270.00")
    assert Decimal(str(res.data["discount_amount"])) == Decimal("27.00")
    assert Decimal(str(res.data["preauth_hold_amount"])) == Decimal("0.00")  # Hold only on CARD
    assert Decimal(str(res.data["total_amount"])) == Decimal("255.00")

    customer_wallet.refresh_from_db()
    assert customer_wallet.balance == Decimal("745.00")


@pytest.mark.django_db
def test_t3_33_centrifugo_token_endpoint_and_order_channel_authorization(
    auth_customer_client,
    auth_supervisor_client,
    customer_user,
    supervisor_user,
    mock_centrifugo,
):
    """Pair 33: Centrifugo Token JWT Subject Verification + Unified Channel Configuration."""
    import jwt
    from django.conf import settings

    res_cust = auth_customer_client.get("/api/v1/realtime/token/")
    assert res_cust.status_code == status.HTTP_200_OK
    decoded_cust = jwt.decode(res_cust.data["token"], settings.CENTRIFUGO_HMAC_SECRET, algorithms=["HS256"])
    assert decoded_cust["sub"] == str(customer_user.id)

    res_sup = auth_supervisor_client.get("/api/v1/realtime/token/")
    assert res_sup.status_code == status.HTTP_200_OK
    decoded_sup = jwt.decode(res_sup.data["token"], settings.CENTRIFUGO_HMAC_SECRET, algorithms=["HS256"])
    assert decoded_sup["sub"] == str(supervisor_user.id)


@pytest.mark.django_db
def test_t3_34_store_listing_prefetch_eliminates_n_plus_1_and_respects_geofence(
    api_client,
    merchant_user,
    egp_currency,
):
    """Pair 34: Store Listing Query Optimization (No N+1 / OSRM Calls) + Geofence Filtering."""
    for i in range(10):
        Restaurant.objects.create(
            owner=merchant_user,
            name=f"متجر سريع {i}",
            currency=egp_currency,
            latitude=Decimal("24.713600"),
            longitude=Decimal("46.675300"),
            delivery_radius_km=10.0,
            is_active=True,
        )
    # Out-of-range store (>100km away)
    out_of_range = Restaurant.objects.create(
        owner=merchant_user,
        name="متجر بعيد جداً",
        currency=egp_currency,
        latitude=Decimal("26.000000"),
        longitude=Decimal("48.000000"),
        delivery_radius_km=5.0,
        is_active=True,
    )

    with CaptureQueriesContext(connection) as ctx:
        res = api_client.get("/api/v1/customer/restaurants/?lat=24.7136&lng=46.6753")
    assert res.status_code == status.HTTP_200_OK
    returned_ids = {r["id"] for r in res.data}
    assert str(out_of_range.id) not in returned_ids
    assert len(returned_ids) >= 10
    # Bounded query count (eliminating 2N+1 per restaurant)
    assert len(ctx) <= 15, f"Too many SQL queries ({len(ctx)}) in store listing — N+1 detected!"
