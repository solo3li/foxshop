"""
Tier 2 Boundary & Corner Cases E2E Test Suite — FoxShop Boost Architecture Overhaul

Requirement-driven opaque-box tests derived from:
- ORIGINAL_REQUEST.md (R1–R5)
- PROJECT.md (Feature Inventory F1–F30 & Interface Contracts)
- TEST_INFRA.md & DISPATCH.md (Tier 2 Boundaries & Stress Matrix)

Covers >= 100 distinct boundary value, edge-limit, concurrency, timeout, and stress tests:
1. Auth, Registration & JWT Refresh Boundaries (F1, F2, F3)
2. Financial & Wallet Order Balance Boundaries (F4, F5)
3. Wallet Top-Up Limits, Ceiling & Daily Cap Boundaries (F7)
4. Variable-Weight Pre-Auth Hold & Confirm-Weights Boundaries (F6)
5. Weekly Payouts, Store-Own-Fleet Commission & Driver Wallet Boundaries (F8, F9, F11)
6. Supervisor Cash Settlement Daily Cumulative Cap Boundaries (F10)
7. Order Number, Dispatch, Concurrency, Sleep Check & Coupon Boundaries (F12–F16)
8. DeliveryZone Geofencing & Contactless Delivery POD Boundaries (F17, F18)
9. Real-Time Centrifugo, GPS Bursts/Extremes, Meilisearch Fallback & Store Listing Boundaries (F19–F30)
"""

import json
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.db import connection, connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Address, PlatformSetting, User
from apps.deliveries.dispatch import (
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
)
from apps.deliveries.services import update_driver_gps
from apps.menus.models import MenuCategory, MenuItem
from apps.notifications.services import publish_centrifugo_event
from apps.orders.models import Order
from apps.payments.models import DriverPayout, Transaction, VendorPayout, Wallet
from apps.promotions.models import Coupon, CouponUsage
from apps.restaurants.models import DeliveryZone as RestaurantDeliveryZone, Restaurant


# ============================================================================
# Shared Helpers (No business logic duplication — test harness helpers only)
# ============================================================================

class _FakeInngestStep:
    def __init__(self):
        self.sleeps = []
        self.runs = []

    def sleep(self, step_id, duration):
        self.sleeps.append((step_id, duration))

    def run(self, step_id, fn):
        self.runs.append(step_id)
        return fn()


class _FakeInngestEvent:
    def __init__(self, data):
        self.data = data


class _FakeInngestCtx:
    def __init__(self, data):
        self.event = _FakeInngestEvent(data)
        self.step = _FakeInngestStep()


def _invoke_inngest_fn(fn_obj, ctx):
    handler = getattr(fn_obj, '_handler', None) or getattr(fn_obj, 'fn', None) or fn_obj
    return handler(ctx)


def _make_unique_user(role, prefix='u', is_staff=False, is_active=True):
    uid = uuid.uuid4().hex[:8]
    user = User.objects.create_user(
        username=f'{prefix}_{uid}',
        password='password123',
        first_name='اختبار',
        last_name=uid[:4],
        phone_number=f'+2010{int(uid[:8], 16) % 100000000:08d}',
        role=role,
        is_staff=is_staff,
        is_active=is_active,
    )
    if role == User.Roles.DRIVER:
        DriverProfile.objects.create(
            user=user,
            vehicle_type=DriverProfile.VehicleTypes.MOTORCYCLE,
            is_online=True,
            is_busy=False,
            current_latitude=24.713600,
            current_longitude=46.675300,
        )
    return user


def _make_store(owner, currency, delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
                min_order_amount=Decimal('30.00'), delivery_fee=Decimal('12.00'),
                delivery_radius_km=15.0, lat=24.713600, lng=46.675300):
    uid = uuid.uuid4().hex[:6]
    return Restaurant.objects.create(
        owner=owner,
        name=f'متجر اختبار {uid}',
        address_text='شارع التحرير',
        latitude=lat,
        longitude=lng,
        delivery_radius_km=delivery_radius_km,
        delivery_mode=delivery_mode,
        currency=currency,
        min_order_amount=min_order_amount,
        delivery_fee=delivery_fee,
        estimated_prep_time_minutes=20,
        is_active=True,
    )


def _make_item(restaurant, price=Decimal('45.00'), pricing_unit=MenuItem.PricingUnit.PIECE):
    cat, _ = MenuCategory.objects.get_or_create(restaurant=restaurant, name='قسم افتراضي')
    uid = uuid.uuid4().hex[:6]
    return MenuItem.objects.create(
        category=cat,
        name=f'صنف {uid}',
        base_price=price,
        pricing_unit=pricing_unit,
        is_available=True,
    )


def _extract_list(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


def _square_polygon(lat_min=24.7000, lat_max=24.7300, lng_min=46.6600, lng_max=46.6900):
    return [
        [lat_min, lng_min],
        [lat_max, lng_min],
        [lat_max, lng_max],
        [lat_min, lng_max],
        [lat_min, lng_min],
    ]


# ============================================================================
# SECTION 1: Auth, Registration & JWT Refresh Boundaries (F1, F2, F3) — 10 tests
# ============================================================================

@pytest.mark.django_db
class TestAuthAndRegistrationBoundaries:
    """Boundary and adversarial input tests for public registration and JWT refresh."""

    @pytest.mark.parametrize('attempted_role', [
        'ADMIN',
        'OPS_MANAGER',
        'SUPERVISOR',
        'MERCHANT',
        'DRIVER',
        'SUPERADMIN',
        '',
    ])
    def test_register_role_escalation_stripped_and_forced_customer(self, api_client, attempted_role):
        uid = uuid.uuid4().hex[:8]
        payload = {
            'username': f'reg_esc_{uid}',
            'password': 'StrongPassword123!',
            'first_name': 'مستخدم',
            'last_name': 'حدي',
            'phone_number': f'+2011{int(uid, 16) % 100000000:08d}',
            'role': attempted_role,
        }
        res = api_client.post('/api/v1/auth/register/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['user']['role'] == User.Roles.CUSTOMER
        user = User.objects.get(username=payload['username'])
        assert user.role == User.Roles.CUSTOMER
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_register_case_insensitive_username_collision_rejected(self, api_client, customer_user):
        uid = uuid.uuid4().hex[:6]
        payload = {
            'username': customer_user.username.upper(),
            'password': 'StrongPassword123!',
            'first_name': 'مكرر',
            'last_name': 'حالة',
            'phone_number': f'+2012{int(uid, 16) % 10000000:07d}1',
        }
        res = api_client.post('/api/v1/auth/register/', payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_password_min_length_boundary_5_vs_6(self, api_client):
        uid = uuid.uuid4().hex[:6]
        res_short = api_client.post('/api/v1/auth/register/', {
            'username': f'pwd5_{uid}',
            'password': '12345',
            'phone_number': f'+2010{int(uid, 16) % 10000000:07d}2',
        }, format='json')
        assert res_short.status_code == status.HTTP_400_BAD_REQUEST

        res_exact = api_client.post('/api/v1/auth/register/', {
            'username': f'pwd6_{uid}',
            'password': '123456',
            'phone_number': f'+2010{int(uid, 16) % 10000000:07d}3',
        }, format='json')
        assert res_exact.status_code == status.HTTP_201_CREATED
        assert 'access' in res_exact.data and 'refresh' in res_exact.data

    def test_jwt_refresh_token_valid_and_invalid_boundaries(self, api_client, customer_user):
        login_res = api_client.post('/api/v1/auth/login/', {
            'username': customer_user.username,
            'password': 'password123',
        }, format='json')
        assert login_res.status_code == status.HTTP_200_OK
        refresh_token = login_res.data['refresh']

        # Valid refresh returns new access token
        ref_ok = api_client.post('/api/v1/auth/token/refresh/', {'refresh': refresh_token}, format='json')
        assert ref_ok.status_code == status.HTTP_200_OK
        assert 'access' in ref_ok.data

        # Empty / malformed refresh tokens rejected with 400/401
        ref_empty = api_client.post('/api/v1/auth/token/refresh/', {'refresh': ''}, format='json')
        assert ref_empty.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED)

        ref_bad = api_client.post('/api/v1/auth/token/refresh/', {'refresh': 'invalid.jwt.token'}, format='json')
        assert ref_bad.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# SECTION 2: Financial & Wallet Order Balance Boundaries (F4, F5) — 11 tests
# ============================================================================

@pytest.mark.django_db
class TestWalletOrderBalanceBoundaries:
    """Boundary tests for wallet balance check, atomic debit, ledger & refund."""

    def test_wallet_checkout_exact_balance_down_to_0_01_egp(
        self, auth_customer_client, customer_user, restaurant, menu_item, customer_address
    ):
        # 2 * 45.00 + 12.00 delivery = 102.00 EGP
        wallet, _ = Wallet.objects.get_or_create(user=customer_user, defaults={'currency': 'EGP'})
        wallet.balance = Decimal('102.00')
        wallet.save()

        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Decimal(str(res.data['total_amount'])) == Decimal('102.00')

        wallet.refresh_from_db()
        assert wallet.balance == Decimal('0.00')
        assert Transaction.objects.filter(
            wallet=wallet, transaction_type=Transaction.Types.ORDER_PAYMENT, amount=Decimal('-102.00')
        ).exists()

    def test_wallet_checkout_exact_fractional_piaster_balance(
        self, auth_customer_client, customer_user, merchant_user, egp_currency, customer_address
    ):
        store = _make_store(merchant_user, egp_currency, min_order_amount=Decimal('10.00'), delivery_fee=Decimal('12.00'))
        item = _make_item(store, price=Decimal('19.99'))
        # Total = 19.99 + 12.00 = 31.99
        wallet, _ = Wallet.objects.get_or_create(user=customer_user, defaults={'currency': 'EGP'})
        wallet.balance = Decimal('31.99')
        wallet.save()

        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(store.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('0.00')

    def test_wallet_checkout_0_01_egp_under_balance_rejected(
        self, auth_customer_client, customer_user, restaurant, menu_item, customer_address
    ):
        # Order total = 102.00, wallet has 101.99 (0.01 short)
        wallet, _ = Wallet.objects.get_or_create(user=customer_user, defaults={'currency': 'EGP'})
        wallet.balance = Decimal('101.99')
        wallet.save()

        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('101.99')
        assert Order.objects.filter(customer=customer_user).count() == 0

    def test_wallet_checkout_zero_balance_rejected(
        self, auth_customer_client, zero_balance_wallet, customer_user, restaurant, menu_item, customer_address
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('0.00')
        assert Order.objects.filter(customer=customer_user).count() == 0

    def test_wallet_checkout_negative_balance_rejected(
        self, auth_customer_client, customer_user, restaurant, menu_item, customer_address
    ):
        wallet, _ = Wallet.objects.get_or_create(user=customer_user, defaults={'currency': 'EGP'})
        wallet.balance = Decimal('-0.01')
        wallet.save()

        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('-0.01')

    def test_wallet_checkout_missing_wallet_record_rejected(
        self, auth_customer_client, customer_user, restaurant, menu_item, customer_address
    ):
        Wallet.objects.filter(user=customer_user).delete()
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert Order.objects.filter(customer=customer_user).count() == 0

    def test_wallet_checkout_zero_total_after_discount_succeeds_with_zero_balance(
        self, auth_customer_client, zero_balance_wallet, customer_user, merchant_user, egp_currency, customer_address
    ):
        store = _make_store(merchant_user, egp_currency, min_order_amount=Decimal('20.00'), delivery_fee=Decimal('0.00'))
        item = _make_item(store, price=Decimal('30.00'))
        now = timezone.now()
        Coupon.objects.create(
            code='FREE100E2E',
            discount_type=Coupon.DiscountTypes.FLAT,
            discount_value=Decimal('30.00'),
            min_order_amount=Decimal('0.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=5),
            is_active=True,
        )

        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(store.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'coupon_code': 'FREE100E2E',
            'items': [{'menu_item_id': str(item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Decimal(str(res.data['total_amount'])) == Decimal('0.00')
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('0.00')

    def test_wallet_checkout_cancellation_refunds_exact_deducted_amount(
        self, auth_customer_client, customer_wallet, customer_user, restaurant, menu_item, customer_address, mock_centrifugo
    ):
        # customer_wallet starts at 1000.00; order total = 45 + 12 = 57.00
        create_res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert create_res.status_code == status.HTTP_201_CREATED
        order_id = create_res.data['id']

        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == Decimal('943.00')

        cancel_res = auth_customer_client.post(f'/api/v1/customer/orders/{order_id}/cancel/', {}, format='json')
        assert cancel_res.status_code == status.HTTP_200_OK

        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == Decimal('1000.00')
        assert Transaction.objects.filter(
            wallet=customer_wallet, transaction_type=Transaction.Types.REFUND, amount=Decimal('57.00')
        ).exists()

    def test_wallet_double_cancel_does_not_double_refund(
        self, auth_customer_client, customer_wallet, restaurant, menu_item, customer_address, mock_centrifugo
    ):
        create_res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert create_res.status_code == status.HTTP_201_CREATED
        order_id = create_res.data['id']

        r1 = auth_customer_client.post(f'/api/v1/customer/orders/{order_id}/cancel/', {}, format='json')
        assert r1.status_code == status.HTTP_200_OK
        r2 = auth_customer_client.post(f'/api/v1/customer/orders/{order_id}/cancel/', {}, format='json')
        assert r2.status_code == status.HTTP_400_BAD_REQUEST

        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == Decimal('1000.00')
        assert Transaction.objects.filter(
            wallet=customer_wallet, transaction_type=Transaction.Types.REFUND
        ).count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_wallet_concurrent_double_spend_prevented(self, egp_currency):
        cust = _make_unique_user(User.Roles.CUSTOMER, prefix='dblspend')
        merch = _make_unique_user(User.Roles.MERCHANT, prefix='dblmerch')
        addr = Address.objects.create(
            user=cust, title='المنزل', street='الشارع', latitude=24.715, longitude=46.676, is_default=True
        )
        store = _make_store(merch, egp_currency, min_order_amount=Decimal('10.00'), delivery_fee=Decimal('10.00'))
        item = _make_item(store, price=Decimal('50.00'))  # Order total = 60.00
        wallet = Wallet.objects.create(user=cust, balance=Decimal('100.00'), currency='EGP')

        barrier = threading.Barrier(2)
        results = []

        def _place():
            try:
                client = APIClient()
                client.force_authenticate(user=cust)
                barrier.wait(timeout=5)
                resp = client.post('/api/v1/customer/orders/checkout/', {
                    'restaurant_id': str(store.id),
                    'delivery_address_id': str(addr.id),
                    'payment_method': Order.PaymentMethod.WALLET,
                    'items': [{'menu_item_id': str(item.id), 'quantity': 1}],
                }, format='json')
                results.append(resp.status_code)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_place)
            f2 = pool.submit(_place)
            f1.result()
            f2.result()

        assert results.count(status.HTTP_201_CREATED) == 1
        assert results.count(status.HTTP_400_BAD_REQUEST) == 1
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('40.00')
        assert wallet.balance >= Decimal('0.00')

    def test_order_below_min_order_amount_by_0_01_rejected(
        self, auth_customer_client, customer_wallet, merchant_user, egp_currency, customer_address
    ):
        store = _make_store(merchant_user, egp_currency, min_order_amount=Decimal('30.00'), delivery_fee=Decimal('12.00'))
        item_below = _make_item(store, price=Decimal('29.99'))
        item_exact = _make_item(store, price=Decimal('30.00'))

        res_below = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(store.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(item_below.id), 'quantity': 1}],
        }, format='json')
        assert res_below.status_code == status.HTTP_400_BAD_REQUEST

        res_exact = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(store.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(item_exact.id), 'quantity': 1}],
        }, format='json')
        assert res_exact.status_code == status.HTTP_201_CREATED


# ============================================================================
# SECTION 3: Wallet Top-Up Limits, Ceiling & Daily Cap Boundaries (F7) — 11 tests
# ============================================================================

@pytest.mark.django_db
class TestWalletTopUpBoundaries:
    """Boundary value tests for simulated wallet top-up constraints."""

    def test_topup_minimum_boundary_1_00_egp_accepted(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '1.00'}, format='json')
        assert res.status_code == status.HTTP_200_OK
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('1.00')

    def test_topup_0_99_egp_below_minimum_rejected(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '0.99'}, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('0.00')

    def test_topup_zero_amount_rejected(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '0.00'}, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('0.00')

    def test_topup_negative_amount_rejected(self, auth_customer_client, customer_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '-50.00'}, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == Decimal('1000.00')

    def test_topup_non_numeric_and_excess_decimal_places_rejected(self, auth_customer_client, zero_balance_wallet):
        r_str = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': 'abc'}, format='json')
        assert r_str.status_code == status.HTTP_400_BAD_REQUEST

        r_dec = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '10.123'}, format='json')
        assert r_dec.status_code == status.HTTP_400_BAD_REQUEST

    def test_topup_per_tx_cap_5000_accepted(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '5000.00'}, format='json')
        assert res.status_code == status.HTTP_200_OK
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('5000.00')

    def test_topup_per_tx_cap_plus_0_01_rejected(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '5000.01'}, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('0.00')

    def test_topup_extreme_amount_100_million_rejected(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '100000000.00'}, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('0.00')

    def test_topup_wallet_ceiling_10000_boundary(self, auth_customer_client, customer_user):
        wallet, _ = Wallet.objects.get_or_create(user=customer_user, defaults={'currency': 'EGP'})
        wallet.balance = Decimal('9500.00')
        wallet.save()

        # Exceeding 10,000 ceiling by 0.01 must be rejected
        res_over = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '500.01'}, format='json')
        assert res_over.status_code == status.HTTP_400_BAD_REQUEST
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('9500.00')

        # Exactly reaching 10,000 ceiling must succeed
        res_exact = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '500.00'}, format='json')
        assert res_exact.status_code == status.HTTP_200_OK
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('10000.00')

    def test_topup_daily_cumulative_cap_exact_vs_exceeded(self, auth_customer_client, zero_balance_wallet):
        r1 = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '2000.00'}, format='json')
        assert r1.status_code == status.HTTP_200_OK
        r2 = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '2000.00'}, format='json')
        assert r2.status_code == status.HTTP_200_OK
        r3 = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '1000.00'}, format='json')
        assert r3.status_code == status.HTTP_200_OK

        # 5000.00 reached today; adding 1.00 more today exceeds daily cap
        r_over = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '1.00'}, format='json')
        assert r_over.status_code == status.HTTP_400_BAD_REQUEST
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('5000.00')

    def test_topup_daily_cap_resets_after_midnight_rollover(self, auth_customer_client, zero_balance_wallet):
        # Record a 5000.00 top-up transaction dated yesterday
        tx = Transaction.objects.create(
            wallet=zero_balance_wallet,
            amount=Decimal('5000.00'),
            transaction_type=Transaction.Types.TOPUP,
            reference_id='YESTERDAY-TOPUP',
            description='شحن أمس',
        )
        yesterday = timezone.now() - timedelta(days=1)
        Transaction.objects.filter(id=tx.id).update(created_at=yesterday)
        zero_balance_wallet.balance = Decimal('5000.00')
        zero_balance_wallet.save()

        # Today's allowance should be fresh (up to 5000.00, within 10,000 ceiling)
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {'amount': '1000.00'}, format='json')
        assert res.status_code == status.HTTP_200_OK
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('6000.00')


# ============================================================================
# SECTION 4: Variable-Weight Pre-Auth Hold & Confirm-Weights Boundaries (F6) — 11 tests
# ============================================================================

@pytest.mark.django_db
class TestVariableWeightPreAuthBoundaries:
    """Boundary tests for 15% pre-auth hold calculation and confirm-weights settlement."""

    def test_confirm_weights_zero_kg_releases_hold_and_zeros_item(
        self, auth_merchant_client, order_factory, weighted_menu_item, mock_centrifugo
    ):
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('120.00'),
                'is_weighted': True,
                'requested_weight': Decimal('1.000'),
            }],
            delivery_fee=Decimal('12.00'),
        )
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': 0.000}]
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        item.refresh_from_db()
        assert item.actual_weight == Decimal('0.000')
        assert item.total_price == Decimal('0.00')
        assert order.preauth_hold_amount == Decimal('0.00')
        assert order.subtotal == Decimal('0.00')

    def test_confirm_weights_lower_than_requested_releases_exact_surplus(
        self, auth_merchant_client, order_factory, weighted_menu_item, mock_centrifugo
    ):
        # Requested: 2.000 kg * 120 = 240.00, 15% hold = 36.00, delivery = 12.00 -> authorized = 288.00
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('120.00'),
                'is_weighted': True,
                'requested_weight': Decimal('2.000'),
            }],
            delivery_fee=Decimal('12.00'),
        )
        item = order.items.first()
        # Actual: 1.500 kg -> 180.00 + 12.00 = 192.00
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': 1.500}]
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        assert order.subtotal == Decimal('180.00')
        assert order.total_amount == Decimal('192.00')
        assert order.preauth_hold_amount == Decimal('0.00')
        assert order.is_weight_confirmed is True

    def test_confirm_weights_exact_requested_weight_releases_15_percent_hold(
        self, auth_merchant_client, order_factory, weighted_menu_item, mock_centrifugo
    ):
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('120.00'),
                'is_weighted': True,
                'requested_weight': Decimal('2.000'),
            }],
            delivery_fee=Decimal('12.00'),
        )
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': 2.000}]
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        assert order.subtotal == Decimal('240.00')
        assert order.total_amount == Decimal('252.00')
        assert order.preauth_hold_amount == Decimal('0.00')
        assert order.is_weight_confirmed is True

    def test_confirm_weights_higher_within_hold_ceiling_captures_from_hold(
        self, auth_merchant_client, order_factory, weighted_menu_item, mock_centrifugo
    ):
        # Requested: 2.000 kg -> 240.00 + 36.00 hold + 12.00 delivery = 288.00 ceiling
        # Actual: 2.250 kg -> 270.00 + 12.00 = 282.00 (<= 288.00)
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('120.00'),
                'is_weighted': True,
                'requested_weight': Decimal('2.000'),
            }],
            delivery_fee=Decimal('12.00'),
        )
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': 2.250}]
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        assert order.subtotal == Decimal('270.00')
        assert order.total_amount == Decimal('282.00')
        assert order.preauth_hold_amount == Decimal('0.00')
        assert order.payment_status == Order.PaymentStatus.PAID

    def test_confirm_weights_extreme_overrun_exceeding_hold_ceiling_rejected(
        self, auth_merchant_client, order_factory, weighted_menu_item, mock_centrifugo
    ):
        # Requested: 1.000 kg -> 120.00 + 18.00 hold + 12.00 delivery = 150.00 authorized ceiling
        # Attempted actual: 5.000 kg -> 600.00 + 12.00 = 612.00 (exceeds preauth hold ceiling!)
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('120.00'),
                'is_weighted': True,
                'requested_weight': Decimal('1.000'),
            }],
            delivery_fee=Decimal('12.00'),
        )
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': 5.000}]
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_preauth_mixed_weighted_and_fixed_items_applies_hold_only_to_weighted(
        self, auth_customer_client, restaurant, menu_item, weighted_menu_item, customer_address
    ):
        # Fixed item: 2 * 45.00 = 90.00; Weighted item: 1.000 * 120.00 = 120.00
        # Hold MUST be 15% of 120.00 = 18.00 (NOT 15% of 210.00 = 31.50)
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.CARD,
            'items': [
                {'menu_item_id': str(menu_item.id), 'quantity': 2},
                {'menu_item_id': str(weighted_menu_item.id), 'quantity': 1, 'requested_weight': 1.000},
            ],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Decimal(str(res.data['subtotal'])) == Decimal('210.00')
        assert Decimal(str(res.data['preauth_hold_amount'])) == Decimal('18.00')
        assert Decimal(str(res.data['total_amount'])) == Decimal('240.00')  # 210 + 12 + 18

    @pytest.mark.parametrize('payment_method,expected_hold', [
        (Order.PaymentMethod.CARD, Decimal('18.00')),
        (Order.PaymentMethod.WALLET, Decimal('0.00')),
        (Order.PaymentMethod.COD, Decimal('0.00')),
    ])
    def test_preauth_hold_applies_exclusively_to_card_payment(
        self, auth_customer_client, customer_wallet, restaurant, weighted_menu_item,
        customer_address, payment_method, expected_hold
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': payment_method,
            'items': [{'menu_item_id': str(weighted_menu_item.id), 'quantity': 1, 'requested_weight': 1.000}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Decimal(str(res.data['preauth_hold_amount'])) == expected_hold

    def test_preauth_gram_pricing_unit_precision_boundary(
        self, auth_customer_client, restaurant, customer_address
    ):
        gram_item = _make_item(restaurant, price=Decimal('100.00'), pricing_unit=MenuItem.PricingUnit.GRAM)
        # 333 grams @ 100.00/1000g = 33.30; 15% hold = round(33.30 * 0.15, 2) = 5.00
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.CARD,
            'items': [{'menu_item_id': str(gram_item.id), 'quantity': 1, 'requested_weight': 333.000}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Decimal(str(res.data['subtotal'])) == Decimal('33.30')
        assert Decimal(str(res.data['preauth_hold_amount'])) == Decimal('5.00')

    @pytest.mark.parametrize('terminal_status', [Order.Status.DELIVERED, Order.Status.CANCELLED])
    def test_confirm_weights_on_terminal_order_rejected(
        self, auth_merchant_client, order_factory, weighted_menu_item, terminal_status
    ):
        order = order_factory(
            status=terminal_status,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('120.00'),
                'is_weighted': True,
                'requested_weight': Decimal('1.000'),
            }],
        )
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': 1.100}]
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================================
# SECTION 5: Weekly Payouts, Store-Own-Fleet Commission & Driver Wallet (F8, F9, F11) — 11 tests
# ============================================================================

@pytest.mark.django_db
class TestPayoutsCommissionAndDriverWalletBoundaries:
    """Boundary tests for commission idempotency, weekly COD exclusion, and driver wallet API."""

    def test_store_own_fleet_repeated_delivered_deducts_commission_strictly_once(
        self, auth_merchant_client, merchant_user, egp_currency, order_factory, mock_centrifugo
    ):
        PlatformSetting.objects.update_or_create(id=1, defaults={'platform_commission_percent': Decimal('15.00')})
        own_store = _make_store(merchant_user, egp_currency, delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET)
        merch_wallet, _ = Wallet.objects.get_or_create(
            user=merchant_user, defaults={'currency': 'EGP', 'balance': Decimal('500.00')}
        )
        merch_wallet.balance = Decimal('500.00')
        merch_wallet.save()

        order = order_factory(
            restaurant_instance=own_store,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.COD,
        )
        expected_comm = round(order.subtotal * Decimal('0.15'), 2)

        for _ in range(3):
            res = auth_merchant_client.post(
                f'/api/v1/merchant/orders/{order.id}/status/',
                {'status': Order.Status.DELIVERED},
                format='json',
            )
            assert res.status_code == status.HTTP_200_OK

        merch_wallet.refresh_from_db()
        assert merch_wallet.balance == Decimal('500.00') - expected_comm
        assert Transaction.objects.filter(
            wallet=merch_wallet, reference_id__icontains=str(order.id)[:8]
        ).count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_store_own_fleet_concurrent_delivered_idempotent(self, egp_currency):
        PlatformSetting.objects.update_or_create(id=1, defaults={'platform_commission_percent': Decimal('15.00')})
        merch = _make_unique_user(User.Roles.MERCHANT, prefix='ownmerch')
        cust = _make_unique_user(User.Roles.CUSTOMER, prefix='owncust')
        addr = Address.objects.create(
            user=cust, title='Home', street='St', latitude=24.715, longitude=46.676, is_default=True
        )
        store = _make_store(merch, egp_currency, delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET)
        wallet = Wallet.objects.create(user=merch, balance=Decimal('500.00'), currency='EGP')
        order = Order.objects.create(
            customer=cust,
            restaurant=store,
            delivery_address=addr,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.COD,
            currency='EGP',
            subtotal=Decimal('200.00'),
            delivery_fee=Decimal('10.00'),
            total_amount=Decimal('210.00'),
        )

        barrier = threading.Barrier(3)
        statuses = []

        def _deliver():
            try:
                client = APIClient()
                client.force_authenticate(user=merch)
                barrier.wait(timeout=5)
                resp = client.post(
                    f'/api/v1/merchant/orders/{order.id}/status/',
                    {'status': Order.Status.DELIVERED},
                    format='json',
                )
                statuses.append(resp.status_code)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=3) as pool:
            futs = [pool.submit(_deliver) for _ in range(3)]
            for f in futs:
                f.result()

        assert all(s == status.HTTP_200_OK for s in statuses)
        wallet.refresh_from_db()
        # 15% of 200.00 = 30.00 deducted ONCE -> 470.00
        assert wallet.balance == Decimal('470.00')

    def test_store_own_fleet_card_order_does_not_deduct_cod_commission_from_wallet(
        self, auth_merchant_client, merchant_user, egp_currency, order_factory, mock_centrifugo
    ):
        own_store = _make_store(merchant_user, egp_currency, delivery_mode=Restaurant.DeliveryMode.STORE_OWN_FLEET)
        merch_wallet, _ = Wallet.objects.get_or_create(
            user=merchant_user, defaults={'currency': 'EGP', 'balance': Decimal('500.00')}
        )
        merch_wallet.balance = Decimal('500.00')
        merch_wallet.save()

        order = order_factory(
            restaurant_instance=own_store,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        res = auth_merchant_client.post(
            f'/api/v1/merchant/orders/{order.id}/status/',
            {'status': Order.Status.DELIVERED},
            format='json',
        )
        assert res.status_code == status.HTTP_200_OK
        merch_wallet.refresh_from_db()
        assert merch_wallet.balance == Decimal('500.00')

    def test_weekly_payout_excludes_cod_from_vendor_disbursement(
        self, restaurant, customer_user, customer_address, order_factory
    ):
        PlatformSetting.objects.update_or_create(id=1, defaults={'platform_commission_percent': Decimal('15.00')})
        today = timezone.now().date()
        last_week_dt = timezone.now() - timedelta(days=today.weekday() + 5)

        cod_order = order_factory(
            customer=customer_user,
            restaurant_instance=restaurant,
            address=customer_address,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.COD,
        )
        Order.objects.filter(id=cod_order.id).update(created_at=last_week_dt)

        ctx = _FakeInngestCtx({})
        _invoke_inngest_fn(fn_weekly_vendor_payouts_cron, ctx)

        payout = VendorPayout.objects.filter(restaurant=restaurant).first()
        # Platform must NOT disburse net cash to vendor for COD sales
        if payout is not None:
            assert payout.net_payout <= Decimal('0.00')

    def test_weekly_payout_driver_settled_cod_not_double_deducted(
        self, restaurant, customer_user, driver_user, customer_address, order_factory, shift_settlement_factory
    ):
        today = timezone.now().date()
        last_week_dt = timezone.now() - timedelta(days=today.weekday() + 5)

        cod_order = order_factory(
            customer=customer_user,
            restaurant_instance=restaurant,
            address=customer_address,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.COD,
        )
        Order.objects.filter(id=cod_order.id).update(created_at=last_week_dt, is_settled_with_merchant=True)

        trip = DeliveryTrip.objects.create(
            order=cod_order,
            driver=driver_user,
            driver_earnings=Decimal('20.00'),
            status=DeliveryTrip.Status.COMPLETED,
        )
        DeliveryTrip.objects.filter(id=trip.id).update(completed_at=last_week_dt)

        shift_settlement_factory(
            restaurant_instance=restaurant,
            driver=driver_user,
            orders=[cod_order],
            total_goods_amount=cod_order.subtotal,
            platform_commission_amount=Decimal('13.50'),
            status=ShiftSettlement.Status.COMPLETED,
            settled_at=last_week_dt,
        )

        # Invoke weekly payout workflow (via Inngest or payments tasks if present)
        try:
            from apps.payments import inngest_functions as pay_inngest
            if hasattr(pay_inngest, 'fn_weekly_payouts_flow'):
                _invoke_inngest_fn(pay_inngest.fn_weekly_payouts_flow, _FakeInngestCtx({}))
        except ImportError:
            from apps.payments.tasks import generate_weekly_payouts
            generate_weekly_payouts()

        dp = DriverPayout.objects.get(driver=driver_user)
        # Settled COD must NOT be deducted again -> net_balance == 20.00 earned
        assert dp.cod_cash_collected == Decimal('0.00')
        assert dp.net_balance == Decimal('20.00')

    def test_driver_wallet_payout_request_minimum_50_egp_boundary(
        self, auth_driver_client, driver_wallet
    ):
        res_below = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': '49.99',
            'note': 'InstaPay driver@ipa',
        }, format='json')
        assert res_below.status_code == status.HTTP_400_BAD_REQUEST

        res_exact = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': '50.00',
            'note': 'InstaPay driver@ipa',
        }, format='json')
        assert res_exact.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_driver_wallet_payout_request_exceeding_balance_by_0_01_rejected(
        self, auth_driver_client, driver_wallet
    ):
        # driver_wallet starts at 500.00
        res_over = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': '500.01',
            'note': 'Overdraw attempt',
        }, format='json')
        assert res_over.status_code == status.HTTP_400_BAD_REQUEST
        driver_wallet.refresh_from_db()
        assert driver_wallet.balance == Decimal('500.00')

    @pytest.mark.parametrize('bad_amount', ['0.00', '-10.00', 'not-a-number'])
    def test_driver_wallet_payout_request_invalid_amounts_rejected(
        self, auth_driver_client, driver_wallet, bad_amount
    ):
        res = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': bad_amount,
            'note': 'Invalid',
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_driver_wallet_cash_deposit_invalid_payloads_rejected(self, auth_driver_client):
        r_zero = auth_driver_client.post('/api/v1/driver/wallet/cash-deposit/', {
            'amount': '0.00', 'reference_number': 'REF-01',
        }, format='json')
        assert r_zero.status_code == status.HTTP_400_BAD_REQUEST

        r_neg = auth_driver_client.post('/api/v1/driver/wallet/cash-deposit/', {
            'amount': '-25.00', 'reference_number': 'REF-02',
        }, format='json')
        assert r_neg.status_code == status.HTTP_400_BAD_REQUEST

        r_noref = auth_driver_client.post('/api/v1/driver/wallet/cash-deposit/', {
            'amount': '100.00', 'reference_number': '',
        }, format='json')
        assert r_noref.status_code == status.HTTP_400_BAD_REQUEST

    def test_driver_wallet_cash_deposit_valid_creates_record(self, auth_driver_client, driver_user):
        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('300.00')
        profile.save()

        res = auth_driver_client.post('/api/v1/driver/wallet/cash-deposit/', {
            'amount': '150.00',
            'reference_number': 'FAWRY-998877',
        }, format='json')
        assert res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_driver_wallet_transactions_isolated_per_driver(self, auth_driver_client, driver_user, driver_wallet):
        Transaction.objects.create(
            wallet=driver_wallet,
            amount=Decimal('75.00'),
            transaction_type=Transaction.Types.PAYOUT,
            reference_id='DRV-TX-1',
            description='أرباح رحلة',
        )
        other_driver = _make_unique_user(User.Roles.DRIVER, prefix='othdrv')
        other_wallet = Wallet.objects.create(user=other_driver, balance=Decimal('999.00'), currency='EGP')
        Transaction.objects.create(
            wallet=other_wallet,
            amount=Decimal('999.00'),
            transaction_type=Transaction.Types.PAYOUT,
            reference_id='OTHER-SECRET-TX',
            description='سري',
        )

        res = auth_driver_client.get('/api/v1/driver/wallet/transactions/')
        assert res.status_code == status.HTTP_200_OK
        items = _extract_list(res.data) if not isinstance(res.data, dict) or 'results' in res.data else res.data.get('transactions', [])
        refs = [str(item.get('reference_id', '')) for item in items]
        assert 'OTHER-SECRET-TX' not in refs


# ============================================================================
# SECTION 6: Supervisor Cash Settlement Daily Cumulative Cap (F10) — 10 tests
# ============================================================================

@pytest.mark.django_db
class TestSupervisorSettlementDailyCapBoundaries:
    """Boundary and evasion tests for supervisor daily cumulative cash settlement limit."""

    def _make_supervisor(self):
        return _make_unique_user(User.Roles.SUPERVISOR, prefix='sup', is_staff=True)

    def test_supervisor_single_settlement_at_exact_daily_cap_approved(self, authenticated_client, driver_user):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup = self._make_supervisor()
        client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('600.00')
        profile.save()

        res = client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': '500.00',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'APPROVED'
        assert res.data['pending_approval'] is False
        profile.refresh_from_db()
        assert profile.cash_in_hand == Decimal('100.00')

    def test_supervisor_single_settlement_at_cap_plus_0_01_pending_approval(self, authenticated_client, driver_user):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup = self._make_supervisor()
        client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('600.00')
        profile.save()

        res = client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': '500.01',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'PENDING_APPROVAL'
        assert res.data['pending_approval'] is True
        profile.refresh_from_db()
        assert profile.cash_in_hand == Decimal('600.00')

    def test_supervisor_multiple_small_settlements_summing_to_exact_cap_approved(
        self, authenticated_client, driver_user
    ):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup = self._make_supervisor()
        client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('700.00')
        profile.save()

        for _ in range(5):
            res = client.post('/api/v1/supervisor/cash/settle/', {
                'driver_id': str(driver_user.id),
                'amount': '100.00',
            }, format='json')
            assert res.status_code == status.HTTP_200_OK
            assert res.data['status'] == 'APPROVED'

        profile.refresh_from_db()
        assert profile.cash_in_hand == Decimal('200.00')

    def test_supervisor_split_evasion_5_rapid_micro_settlements_blocked(
        self, authenticated_client, driver_user
    ):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup = self._make_supervisor()
        client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('1000.00')
        profile.save()

        # First 4 * 120 = 480 <= 500 -> APPROVED
        for _ in range(4):
            r = client.post('/api/v1/supervisor/cash/settle/', {
                'driver_id': str(driver_user.id),
                'amount': '120.00',
            }, format='json')
            assert r.status_code == status.HTTP_200_OK
            assert r.data['status'] == 'APPROVED'

        # 5th * 120 pushes cumulative to 600 > 500 -> MUST require manager approval or reject
        r5 = client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': '120.00',
        }, format='json')
        assert (
            r5.status_code == status.HTTP_400_BAD_REQUEST
            or r5.data.get('pending_approval') is True
            or r5.data.get('status') == 'PENDING_APPROVAL'
        )
        profile.refresh_from_db()
        assert profile.cash_in_hand == Decimal('520.00')  # 1000 - 480

    def test_supervisor_cumulative_cap_plus_0_01_blocked(self, authenticated_client, driver_user):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup = self._make_supervisor()
        client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('800.00')
        profile.save()

        r1 = client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id), 'amount': '400.00',
        }, format='json')
        assert r1.data['status'] == 'APPROVED'

        r2 = client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id), 'amount': '100.01',
        }, format='json')
        assert (
            r2.status_code == status.HTTP_400_BAD_REQUEST
            or r2.data.get('pending_approval') is True
            or r2.data.get('status') == 'PENDING_APPROVAL'
        )

    def test_supervisor_midnight_day_boundary_resets_daily_cap(self, authenticated_client, driver_user):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup = self._make_supervisor()
        client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('1000.00')
        profile.save()

        yesterday_settlement = DriverCashSettlement.objects.create(
            driver=driver_user,
            supervisor=sup,
            amount=Decimal('500.00'),
            balance_before=Decimal('1500.00'),
            balance_after=Decimal('1000.00'),
            status=DriverCashSettlement.Status.APPROVED,
        )
        yesterday_dt = timezone.now() - timedelta(days=1)
        DriverCashSettlement.objects.filter(id=yesterday_settlement.id).update(created_at=yesterday_dt)

        # Today's cumulative is 0.00 -> settling 500.00 today must be APPROVED
        res = client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id), 'amount': '500.00',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'APPROVED'

    def test_supervisor_multi_supervisor_independent_daily_caps(self, authenticated_client, driver_user):
        PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
        sup_a = self._make_supervisor()
        sup_b = self._make_supervisor()

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('1200.00')
        profile.save()

        # Supervisor A exhausts daily cap
        r_a = authenticated_client(sup_a).post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id), 'amount': '500.00',
        }, format='json')
        assert r_a.data['status'] == 'APPROVED'

        # Supervisor B still has full 500.00 daily cap
        r_b = authenticated_client(sup_b).post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id), 'amount': '500.00',
        }, format='json')
        assert r_b.status_code == status.HTTP_200_OK
        assert r_b.data['status'] == 'APPROVED'

    @pytest.mark.parametrize('bad_amount', ['0.00', '-10.00', 'invalid'])
    def test_supervisor_settlement_invalid_amounts_rejected(
        self, authenticated_client, driver_user, bad_amount
    ):
        sup = self._make_supervisor()
        res = authenticated_client(sup).post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id), 'amount': bad_amount,
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================================
# SECTION 7: Order Number, Dispatch, Concurrency, Sleep & Coupons (F12–F16) — 18 tests
# ============================================================================

@pytest.mark.django_db
class TestOrderNumberDispatchConcurrencyAndCoupons:
    """Boundary tests for order number entropy, race locking, batch exclusion, sleep check, and coupons."""

    def test_order_number_uniqueness_and_length_across_100_orders(
        self, customer_user, restaurant, customer_address
    ):
        orders = [
            Order.objects.create(
                customer=customer_user,
                restaurant=restaurant,
                delivery_address=customer_address,
                subtotal=Decimal('50.00'),
                delivery_fee=Decimal('12.00'),
                total_amount=Decimal('62.00'),
                currency='EGP',
            )
            for _ in range(100)
        ]
        numbers = [o.order_number for o in orders]
        assert len(set(numbers)) == 100
        assert all(n.startswith('FOX-') and len(n) <= 20 for n in numbers)

    def test_order_number_high_entropy_not_6_digit_bounded(self, order_factory):
        numbers = [order_factory().order_number for _ in range(10)]
        # Collision-free scheme must NOT be bounded 6-digit random (FOX-100000..999999)
        for num in numbers:
            suffix = num.replace('FOX-', '')
            assert not (len(suffix) == 6 and suffix.isdigit()), (
                f"order_number '{num}' uses legacy bounded 6-digit random scheme!"
            )

    @pytest.mark.parametrize('num_drivers', [2, 3, 5])
    @pytest.mark.django_db(transaction=True)
    def test_concurrent_driver_offer_acceptance_only_one_wins(self, egp_currency, num_drivers):
        cust = _make_unique_user(User.Roles.CUSTOMER, prefix='rcust')
        merch = _make_unique_user(User.Roles.MERCHANT, prefix='rmerch')
        addr = Address.objects.create(
            user=cust, title='Home', street='St', latitude=24.715, longitude=46.676, is_default=True
        )
        store = _make_store(merch, egp_currency)
        order = Order.objects.create(
            customer=cust,
            restaurant=store,
            delivery_address=addr,
            status=Order.Status.PREPARING,
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('15.00'),
            total_amount=Decimal('115.00'),
            currency='EGP',
        )
        drivers = [_make_unique_user(User.Roles.DRIVER, prefix=f'rdrv{i}') for i in range(num_drivers)]
        offers = broadcast_delivery_offers(
            order, [(d, 1.0) for d in drivers], batch_number=1, timeout_seconds=60
        )

        barrier = threading.Barrier(num_drivers)
        statuses = []

        def _accept(drv, off_id):
            try:
                client = APIClient()
                client.force_authenticate(user=drv)
                barrier.wait(timeout=5)
                resp = client.post(f'/api/v1/driver/deliveries/offers/{off_id}/accept/', {}, format='json')
                statuses.append(resp.status_code)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=num_drivers) as pool:
            futs = [pool.submit(_accept, d, o.id) for d, o in zip(drivers, offers)]
            for f in futs:
                f.result()

        assert status.HTTP_500_INTERNAL_SERVER_ERROR not in statuses
        assert statuses.count(status.HTTP_200_OK) == 1
        assert statuses.count(status.HTTP_409_CONFLICT) == num_drivers - 1
        assert DeliveryTrip.objects.filter(order=order).count() == 1

    def test_driver_accept_offer_1_second_after_expiration_rejected(
        self, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.5,
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        res = auth_driver_client.post(f'/api/v1/driver/deliveries/offers/{offer.id}/accept/', {}, format='json')
        assert res.status_code == status.HTTP_409_CONFLICT
        offer.refresh_from_db()
        assert offer.status == DeliveryOffer.Status.TIMED_OUT
        assert DeliveryTrip.objects.filter(order=order).count() == 0

    def test_driver_accept_offer_1_second_before_expiration_accepted(
        self, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.5,
            expires_at=timezone.now() + timedelta(seconds=2),
        )
        res = auth_driver_client.post(f'/api/v1/driver/deliveries/offers/{offer.id}/accept/', {}, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert DeliveryTrip.objects.filter(order=order, driver=driver_user).count() == 1

    def test_driver_accept_offer_after_customer_cancels_order_rejected(
        self, auth_customer_client, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PENDING)
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.0,
            expires_at=timezone.now() + timedelta(seconds=60),
        )
        cancel_res = auth_customer_client.post(f'/api/v1/customer/orders/{order.id}/cancel/', {}, format='json')
        assert cancel_res.status_code == status.HTTP_200_OK

        accept_res = auth_driver_client.post(f'/api/v1/driver/deliveries/offers/{offer.id}/accept/', {}, format='json')
        assert accept_res.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT)
        assert DeliveryTrip.objects.filter(order=order).count() == 0

    def test_driver_accept_offer_after_merchant_cancels_order_rejected(
        self, auth_merchant_client, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.0,
            expires_at=timezone.now() + timedelta(seconds=60),
        )
        cancel_res = auth_merchant_client.post(
            f'/api/v1/merchant/orders/{order.id}/status/',
            {'status': Order.Status.CANCELLED, 'reason': 'نفد الصنف'},
            format='json',
        )
        assert cancel_res.status_code == status.HTTP_200_OK

        accept_res = auth_driver_client.post(f'/api/v1/driver/deliveries/offers/{offer.id}/accept/', {}, format='json')
        assert accept_res.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT)
        assert DeliveryTrip.objects.filter(order=order).count() == 0

    def test_driver_accept_another_drivers_offer_rejected(
        self, authenticated_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.0,
            expires_at=timezone.now() + timedelta(seconds=60),
        )
        other_driver = _make_unique_user(User.Roles.DRIVER, prefix='intruder')
        res = authenticated_client(other_driver).post(
            f'/api/v1/driver/deliveries/offers/{offer.id}/accept/', {}, format='json'
        )
        assert res.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_409_CONFLICT)
        assert DeliveryTrip.objects.filter(order=order).count() == 0

    def test_batch_dispatch_excludes_timed_out_drivers_from_subsequent_batch(
        self, order_factory, mock_centrifugo, mock_inngest
    ):
        cache.clear()
        order = order_factory(status=Order.Status.PREPARING)
        drv1 = _make_unique_user(User.Roles.DRIVER, prefix='b1drv')
        drv2 = _make_unique_user(User.Roles.DRIVER, prefix='b2drv')

        # Only drv1 was offered in batch 1 and timed out
        DeliveryOffer.objects.create(
            order=order,
            driver=drv1,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.0,
            expires_at=timezone.now() - timedelta(seconds=5),
        )

        ctx = _FakeInngestCtx({'order_id': str(order.id), 'batch': 1, 'timeout_seconds': 45})
        result = _invoke_inngest_fn(fn_driver_offer_timeout_handler, ctx)

        batch2_driver_ids = set(
            DeliveryOffer.objects.filter(order=order, batch_number=2).values_list('driver_id', flat=True)
        )
        assert drv1.id not in batch2_driver_ids, "Timed-out batch 1 driver must be excluded from batch 2!"
        assert drv2.id in batch2_driver_ids
        assert result['status'] == 're_broadcasted'

    def test_batch_dispatch_excludes_declining_driver_from_candidates(
        self, order_factory, driver_user, mock_centrifugo
    ):
        cache.clear()
        order = order_factory(status=Order.Status.PREPARING)
        drv2 = _make_unique_user(User.Roles.DRIVER, prefix='cand2')
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.0,
            expires_at=timezone.now() + timedelta(seconds=45),
        )
        ok, _ = reject_delivery_offer(offer.id, driver_user)
        assert ok is True

        candidates = [d for d, _ in find_candidate_drivers(order, radius_km=15.0, limit=10)]
        assert driver_user not in candidates
        assert drv2 in candidates

    def test_batch_dispatch_stops_at_batch_3_and_triggers_manual_alert(
        self, order_factory, driver_user, mock_centrifugo, mock_inngest
    ):
        order = order_factory(status=Order.Status.PREPARING)
        DeliveryOffer.objects.create(
            order=order,
            driver=driver_user,
            batch_number=3,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=Decimal('12.00'),
            estimated_distance_km=1.0,
            expires_at=timezone.now() - timedelta(seconds=5),
        )
        ctx = _FakeInngestCtx({'order_id': str(order.id), 'batch': 3, 'timeout_seconds': 45})
        result = _invoke_inngest_fn(fn_driver_offer_timeout_handler, ctx)

        assert result['status'] == 'manual_dispatch_required'
        assert DeliveryOffer.objects.filter(order=order, batch_number=4).count() == 0
        assert len(mock_centrifugo.events) >= 1

    def test_inngest_auto_dispatch_aborts_if_order_cancelled_during_sleep(
        self, order_factory, driver_user, mock_centrifugo, mock_inngest
    ):
        order = order_factory(status=Order.Status.CANCELLED)
        ctx = _FakeInngestCtx({'order_id': str(order.id), 'prep_minutes': 15})
        result = _invoke_inngest_fn(fn_order_auto_dispatch_flow, ctx)

        assert DeliveryOffer.objects.filter(order=order).count() == 0
        assert result.get('status') != 'broadcasted'

    def test_inngest_auto_dispatch_zero_or_short_prep_time_no_negative_sleep(
        self, order_factory, driver_user, mock_centrifugo, mock_inngest
    ):
        order = order_factory(status=Order.Status.PREPARING)
        ctx = _FakeInngestCtx({'order_id': str(order.id), 'prep_minutes': 2})
        result = _invoke_inngest_fn(fn_order_auto_dispatch_flow, ctx)

        assert all(dur.total_seconds() >= 0 for _, dur in ctx.step.sleeps)
        assert result['status'] == 'broadcasted'

    def test_coupon_restored_after_customer_cancels_order(
        self, auth_customer_client, customer_user, restaurant, menu_item, customer_address, mock_centrifugo
    ):
        now = timezone.now()
        coupon = Coupon.objects.create(
            code='RESTORE1USE',
            discount_type=Coupon.DiscountTypes.FLAT,
            discount_value=Decimal('10.00'),
            min_order_amount=Decimal('20.00'),
            max_usage_per_user=1,
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=7),
            is_active=True,
        )
        payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': 'RESTORE1USE',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }
        r1 = auth_customer_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert r1.status_code == status.HTTP_201_CREATED
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1

        c_res = auth_customer_client.post(f"/api/v1/customer/orders/{r1.data['id']}/cancel/", {}, format='json')
        assert c_res.status_code == status.HTTP_200_OK
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0

        # Reuse restored coupon on new order
        r2 = auth_customer_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert r2.status_code == status.HTTP_201_CREATED

    def test_coupon_restored_after_merchant_cancels_order(
        self, auth_customer_client, auth_merchant_client, customer_user, restaurant, menu_item,
        customer_address, mock_centrifugo
    ):
        now = timezone.now()
        coupon = Coupon.objects.create(
            code='MERCHCANCEL',
            discount_type=Coupon.DiscountTypes.PERCENT,
            discount_value=Decimal('10.00'),
            min_order_amount=Decimal('20.00'),
            max_usage_per_user=1,
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=7),
            is_active=True,
        )
        payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': 'MERCHCANCEL',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }
        r1 = auth_customer_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert r1.status_code == status.HTTP_201_CREATED

        m_res = auth_merchant_client.post(
            f"/api/v1/merchant/orders/{r1.data['id']}/status/",
            {'status': Order.Status.CANCELLED, 'reason': 'مغلق'},
            format='json',
        )
        assert m_res.status_code == status.HTTP_200_OK
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0

        r2 = auth_customer_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert r2.status_code == status.HTTP_201_CREATED

    def test_coupon_min_order_amount_exact_vs_0_01_below(
        self, auth_customer_client, merchant_user, egp_currency, customer_address
    ):
        now = timezone.now()
        store = _make_store(merchant_user, egp_currency, min_order_amount=Decimal('10.00'))
        item_below = _make_item(store, price=Decimal('99.99'))
        item_exact = _make_item(store, price=Decimal('100.00'))
        Coupon.objects.create(
            code='MIN100',
            discount_type=Coupon.DiscountTypes.FLAT,
            discount_value=Decimal('15.00'),
            min_order_amount=Decimal('100.00'),
            max_usage_per_user=2,
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=7),
            is_active=True,
        )

        r_below = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(store.id),
            'delivery_address_id': str(customer_address.id),
            'coupon_code': 'MIN100',
            'items': [{'menu_item_id': str(item_below.id), 'quantity': 1}],
        }, format='json')
        assert r_below.status_code == status.HTTP_400_BAD_REQUEST

        r_exact = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(store.id),
            'delivery_address_id': str(customer_address.id),
            'coupon_code': 'MIN100',
            'items': [{'menu_item_id': str(item_exact.id), 'quantity': 1}],
        }, format='json')
        assert r_exact.status_code == status.HTTP_201_CREATED
        assert Decimal(str(r_exact.data['discount_amount'])) == Decimal('15.00')


# ============================================================================
# SECTION 8: DeliveryZone, Geofencing & Contactless Delivery POD (F17, F18) — 17 tests
# ============================================================================

@pytest.mark.django_db
class TestGeofencingAndContactlessDeliveryBoundaries:
    """Boundary tests for DeliveryZone coordinates, radius limits, zone link, and POD photo enforcement."""

    def test_polygon_point_1_meter_inside_returns_true(self, egp_currency):
        zone = RestaurantDeliveryZone.objects.create(
            name='مربع الرياض',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        # ~1.1m inside southern & western border (0.00001 deg ~ 1.1m)
        assert zone.contains_point(24.70001, 46.66001) is True

    def test_polygon_point_1_meter_outside_returns_false(self, egp_currency):
        zone = RestaurantDeliveryZone.objects.create(
            name='مربع الرياض',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        assert zone.contains_point(24.69999, 46.67500) is False
        assert zone.contains_point(24.73001, 46.67500) is False

    def test_polygon_exact_edge_and_vertex_handled_without_error(self, egp_currency):
        zone = RestaurantDeliveryZone.objects.create(
            name='مربع حدي',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        edge_res = zone.contains_point(24.7000, 46.6750)
        vertex_res = zone.contains_point(24.7000, 46.6600)
        assert isinstance(edge_res, bool)
        assert isinstance(vertex_res, bool)

    def test_zero_delivery_radius_allows_exact_center_rejects_100m_away(self, merchant_user, egp_currency):
        store = _make_store(merchant_user, egp_currency, delivery_radius_km=0.0, lat=24.713600, lng=46.675300)
        in_exact, _ = store.is_within_delivery_range(24.713600, 46.675300)
        in_away, _ = store.is_within_delivery_range(24.714500, 46.675300)
        assert in_exact is True
        assert in_away is False

    def test_delivery_radius_max_boundary_inside_vs_outside(self, merchant_user, egp_currency):
        store = _make_store(merchant_user, egp_currency, delivery_radius_km=5.0, lat=24.713600, lng=46.675300)
        # 1 deg lat ~ 111.19 km -> 0.044 deg ~ 4.89 km (inside), 0.046 deg ~ 5.11 km (outside)
        in_ok, dist_ok = store.is_within_delivery_range(24.713600 + 0.044, 46.675300)
        in_out, dist_out = store.is_within_delivery_range(24.713600 + 0.046, 46.675300)
        assert dist_ok < 5.0 and in_ok is True
        assert dist_out > 5.0 and in_out is False

    @pytest.mark.parametrize('bad_coords', [
        [],
        [[24.70, 46.66]],
        [[24.70, 46.66], [24.73, 46.69]],
    ])
    def test_degenerate_polygon_coordinates_return_false_safely(self, egp_currency, bad_coords):
        zone = RestaurantDeliveryZone.objects.create(
            name='مضلع فارغ',
            currency=egp_currency,
            polygon_coordinates=bad_coords,
            is_active=True,
        )
        assert zone.contains_point(24.7150, 46.6750) is False

    def test_checkout_1_meter_outside_assigned_polygon_rejected(
        self, auth_customer_client, customer_user, restaurant, menu_item, egp_currency
    ):
        zone = RestaurantDeliveryZone.objects.create(
            name='منطقة مقيدة',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        restaurant.delivery_zones.add(zone)
        outside_addr = Address.objects.create(
            user=customer_user,
            title='خارج الحد بمتر',
            street='الشارع',
            latitude=24.69999,
            longitude=46.67500,
        )
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(outside_addr.id),
            'payment_method': Order.PaymentMethod.COD,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_operational_delivery_zone_reconciled_with_restaurant_zone(self):
        # F18: deliveries.DeliveryZone must expose a relational link to restaurants.DeliveryZone
        ops_field_names = {f.name for f in OpsDeliveryZone._meta.get_fields()}
        rest_field_names = {f.name for f in RestaurantDeliveryZone._meta.get_fields()}
        has_link = (
            any('zone' in n or 'restaurant' in n for n in ops_field_names if n not in ('id',))
            or any('ops' in n or 'operational' in n or 'shift' in n for n in rest_field_names)
        )
        assert has_link, (
            f"DeliveryZone models remain split without relational link! "
            f"Ops fields={ops_field_names}, Rest fields={rest_field_names}"
        )

    def test_contactless_delivery_missing_photo_rejected(
        self, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY)
        trip = DeliveryTrip.objects.create(
            order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP, driver_earnings=Decimal('12.00')
        )
        res = auth_driver_client.post(
            f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/',
            {'is_contactless': True},
            format='json',
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        trip.refresh_from_db()
        assert trip.status != DeliveryTrip.Status.COMPLETED

    @pytest.mark.parametrize('invalid_photo', ['', '   ', None, 'not-a-valid-url-or-file', 'ftp://bad'])
    def test_contactless_delivery_empty_or_corrupted_photo_rejected(
        self, auth_driver_client, driver_user, order_factory, mock_centrifugo, invalid_photo
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY)
        trip = DeliveryTrip.objects.create(
            order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP, driver_earnings=Decimal('12.00')
        )
        res = auth_driver_client.post(
            f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/',
            {'is_contactless': True, 'pod_photo': invalid_photo, 'photo_url': invalid_photo},
            format='json',
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        trip.refresh_from_db()
        assert trip.status != DeliveryTrip.Status.COMPLETED

    def test_contactless_delivery_valid_photo_completes_order(
        self, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY, payment_method=Order.PaymentMethod.WALLET)
        trip = DeliveryTrip.objects.create(
            order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP, driver_earnings=Decimal('12.00')
        )
        res = auth_driver_client.post(
            f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/',
            {
                'is_contactless': True,
                'pod_photo': 'https://cdn.foxshop.local/media/pod/proof-123.jpg',
                'note': 'عند باب الشقة',
            },
            format='json',
        )
        assert res.status_code == status.HTTP_200_OK
        trip.refresh_from_db()
        order.refresh_from_db()
        assert trip.status == DeliveryTrip.Status.COMPLETED
        assert order.status == Order.Status.DELIVERED

    @pytest.mark.parametrize('bad_otp', ['0000', '', '1234567'])
    def test_otp_delivery_wrong_or_malformed_otp_rejected(
        self, auth_driver_client, driver_user, order_factory, bad_otp
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY)
        trip = DeliveryTrip.objects.create(
            order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP, driver_earnings=Decimal('12.00')
        )
        actual_otp = '9999' if bad_otp == '0000' else '1234'
        DeliveryTrip.objects.filter(id=trip.id).update(delivery_otp=actual_otp)

        res = auth_driver_client.post(
            f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/',
            {'otp': bad_otp},
            format='json',
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_otp_delivery_exact_otp_completes_and_increments_cod_cash(
        self, auth_driver_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY, payment_method=Order.PaymentMethod.COD)
        trip = DeliveryTrip.objects.create(
            order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP, driver_earnings=Decimal('12.00')
        )
        profile = driver_user.driver_profile
        initial_cash = profile.cash_in_hand

        res = auth_driver_client.post(
            f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/',
            {'otp': trip.delivery_otp},
            format='json',
        )
        assert res.status_code == status.HTTP_200_OK
        profile.refresh_from_db()
        assert profile.cash_in_hand == initial_cash + order.total_amount


# ============================================================================
# SECTION 9: Real-Time Centrifugo, GPS, Meilisearch, Store Listing & Infra (F19–F30) — 23 tests
# ============================================================================

@pytest.mark.django_db
class TestRealTimeSearchAndPerformanceBoundaries:
    """Boundary, burst, fallback, and architecture verification tests."""

    def test_centrifugo_payload_arabic_emojis_special_chars_and_empty_strings(self, mock_centrifugo):
        payload = {
            'order_id': 'ord-unicode-1',
            'customer_name': 'أحمد محمد 🦊🚀✅',
            'notes': 'بدون بصل "مقلي"\n<script>alert(1)</script>',
            'empty_field': '',
        }
        ok = publish_centrifugo_event('orders:order_unicode_1', 'STATUS_CHANGED', payload)
        assert ok is True
        assert len(mock_centrifugo.events) == 1
        ev = mock_centrifugo.events[0]
        assert ev['customer_name'] == 'أحمد محمد 🦊🚀✅'
        assert ev['empty_field'] == ''
        assert json.loads(json.dumps(ev.payload))['notes'] == payload['notes']

    def test_centrifugo_order_events_unified_on_orders_order_id_channel(
        self, auth_customer_client, auth_merchant_client, restaurant, menu_item, customer_address, mock_centrifugo
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        order_id = res.data['id']
        mock_centrifugo.clear()

        auth_merchant_client.post(
            f'/api/v1/merchant/orders/{order_id}/status/',
            {'status': Order.Status.CONFIRMED},
            format='json',
        )
        expected_channel = f'orders:order_{order_id}'
        assert mock_centrifugo.has_event(channel=expected_channel)
        assert not mock_centrifugo.has_event(channel=f'tracking:order_{order_id}')

    def test_centrifugo_driver_location_broadcast_uses_unified_orders_channel(
        self, driver_user, order_factory, mock_centrifugo, mock_redis_geo
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY)
        DeliveryTrip.objects.create(
            order=order, driver=driver_user, status=DeliveryTrip.Status.PICKED_UP, driver_earnings=Decimal('12.00')
        )
        mock_centrifugo.clear()

        update_driver_gps(driver_user, latitude=24.720000, longitude=46.680000, heading=45.0, speed=30.0)
        assert mock_centrifugo.has_event(channel=f'orders:order_{order.id}', event_type='DRIVER_LOCATION')

    def test_centrifugo_supervisor_actions_broadcast_to_supervisor_operations(
        self, auth_supervisor_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        mock_centrifugo.clear()

        res = auth_supervisor_client.post('/api/v1/supervisor/dispatch/assign/', {
            'order_id': str(order.id),
            'driver_id': str(driver_user.id),
            'mode': 'direct',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert mock_centrifugo.has_event(channel='supervisor:operations')

    def test_centrifugo_config_contains_orders_and_supervisor_namespaces(self):
        cfg_path = Path(__file__).resolve().parents[2] / 'centrifugo_config.json'
        data = json.loads(cfg_path.read_text(encoding='utf-8'))
        namespaces = {ns['name']: ns for ns in data.get('namespaces', [])}
        assert 'orders' in namespaces
        assert 'supervisor' in namespaces
        assert namespaces['orders'].get('allow_subscribe_for_client') is True
        assert namespaces['supervisor'].get('allow_subscribe_for_client') is True

    def test_gps_high_frequency_burst_50_updates_throttles_db_writes(
        self, auth_driver_client, driver_user, mock_redis_geo, mock_centrifugo
    ):
        with CaptureQueriesContext(connection) as ctx:
            for i in range(50):
                lat = round(24.713600 + i * 0.0001, 6)
                lon = round(46.675300 + i * 0.0001, 6)
                res = auth_driver_client.post('/api/v1/driver/gps/', {
                    'latitude': lat,
                    'longitude': lon,
                    'heading': float(i % 360),
                    'speed': 40.0,
                }, format='json')
                assert res.status_code == status.HTTP_200_OK

        final_coords = mock_redis_geo.get_driver_coords(driver_user.id)
        assert final_coords is not None
        assert final_coords == (round(46.675300 + 49 * 0.0001, 6), round(24.713600 + 49 * 0.0001, 6))

        db_updates = [
            q['sql'] for q in ctx.captured_queries
            if 'UPDATE' in q['sql'].upper() and 'deliveries_driverprofile' in q['sql'].lower()
        ]
        assert len(db_updates) <= 5, f"Expected write-behind throttling (<=5 DB updates), got {len(db_updates)}!"

    @pytest.mark.parametrize('lat,lon', [
        (90.0, 180.0),
        (-90.0, -180.0),
        (0.0, 0.0),
    ])
    def test_gps_geographic_extremes_accepted(
        self, auth_driver_client, driver_user, mock_redis_geo, lat, lon
    ):
        res = auth_driver_client.post('/api/v1/driver/gps/', {
            'latitude': lat,
            'longitude': lon,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert mock_redis_geo.get_driver_coords(driver_user.id) == (lon, lat)

    @pytest.mark.parametrize('lat,lon', [
        (90.0001, 0.0),
        (-90.0001, 0.0),
        (0.0, 180.0001),
        (0.0, -180.0001),
    ])
    def test_gps_out_of_bounds_coordinates_rejected(self, auth_driver_client, lat, lon):
        res = auth_driver_client.post('/api/v1/driver/gps/', {
            'latitude': lat,
            'longitude': lon,
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_meilisearch_connection_refused_falls_back_to_db_search(
        self, api_client, restaurant, menu_item
    ):
        cache.clear()
        with patch('apps.menus.meilisearch_service.get_meili_client', side_effect=ConnectionRefusedError("Meili down")):
            res = api_client.get('/api/v1/customer/search/?q=مارجريتا')
            assert res.status_code == status.HTTP_200_OK
            names = [p['name'] for p in res.data.get('products', [])]
            assert menu_item.name in names

    def test_meilisearch_timeout_falls_back_to_db_search(
        self, api_client, restaurant, menu_item
    ):
        cache.clear()
        with patch('apps.menus.meilisearch_service.get_meili_client', side_effect=TimeoutError("Meili timeout")):
            res = api_client.get(f'/api/v1/customer/search/?q={restaurant.name[:5]}')
            assert res.status_code == status.HTTP_200_OK
            store_ids = [s['id'] for s in res.data.get('stores', [])]
            assert str(restaurant.id) in store_ids

    @pytest.mark.parametrize('weird_q', ['', "' OR 1=1 --", '🍔🔥🍕', 'x' * 300])
    def test_search_edge_queries_handled_without_500(self, api_client, weird_q):
        cache.clear()
        res = api_client.get('/api/v1/customer/search/', {'q': weird_q})
        assert res.status_code == status.HTTP_200_OK
        assert 'stores' in res.data and 'products' in res.data

    def test_store_listing_zero_stores_returns_empty_list(self, api_client):
        Restaurant.objects.all().delete()
        res = api_client.get('/api/v1/customer/restaurants/')
        assert res.status_code == status.HTTP_200_OK
        assert _extract_list(res.data) == []

    def test_store_listing_single_store_returns_one(self, api_client, restaurant):
        res = api_client.get('/api/v1/customer/restaurants/')
        assert res.status_code == status.HTTP_200_OK
        items = _extract_list(res.data)
        assert len(items) == 1
        assert items[0]['id'] == str(restaurant.id)

    def test_store_listing_100_stores_no_osrm_calls_and_bounded_sql_queries(
        self, api_client, merchant_user, egp_currency
    ):
        zone = RestaurantDeliveryZone.objects.create(
            name='زون التغطية',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        stores = [
            Restaurant.objects.create(
                owner=merchant_user,
                name=f'متجر رقم {i}',
                slug=f'store-bva-{i}-{uuid.uuid4().hex[:4]}',
                address_text='الرياض',
                latitude=24.713600,
                longitude=46.675300,
                delivery_radius_km=15.0,
                currency=egp_currency,
                is_active=True,
            )
            for i in range(100)
        ]
        for s in stores:
            s.delivery_zones.add(zone)

        osrm_mock_called = False

        def _fail_osrm(*args, **kwargs):
            nonlocal osrm_mock_called
            osrm_mock_called = True
            raise AssertionError("Store listing must NOT call synchronous OSRM per store!")

        with patch('apps.deliveries.osrm_service.get_driving_route', side_effect=_fail_osrm), \
             CaptureQueriesContext(connection) as ctx:
            res = api_client.get('/api/v1/customer/restaurants/?lat=24.7136&lng=46.6753')

        assert res.status_code == status.HTTP_200_OK
        assert osrm_mock_called is False
        assert len(ctx.captured_queries) <= 25, (
            f"2N+1 query regression: executed {len(ctx.captured_queries)} queries for 100 stores!"
        )

    def test_store_listing_invalid_lat_lng_handled_gracefully(self, api_client, restaurant):
        res = api_client.get('/api/v1/customer/restaurants/?lat=invalid&lng=nan_str')
        assert res.status_code == status.HTTP_200_OK
        assert len(_extract_list(res.data)) >= 1

    def test_celery_completely_purged_from_backend(self):
        backend_root = Path(__file__).resolve().parents[2]
        assert not (backend_root / 'core' / 'celery.py').exists(), "core/celery.py must be removed!"
        tasks_file = backend_root / 'apps' / 'payments' / 'tasks.py'
        if tasks_file.exists():
            content = tasks_file.read_text(encoding='utf-8')
            assert 'celery' not in content.lower() and '@shared_task' not in content

    def test_circular_symlink_backend_backend_removed(self):
        backend_root = Path(__file__).resolve().parents[2]
        symlink_path = backend_root / 'backend'
        assert not symlink_path.exists() and not os.path.islink(symlink_path), (
            f"Circular symlink {symlink_path} still exists!"
        )
