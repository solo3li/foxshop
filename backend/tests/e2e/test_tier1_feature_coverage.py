"""
Tier 1 Feature Coverage E2E Test Suite — FoxShop Boost Architecture Overhaul
=========================================================================
Covers all 30 features (F1–F30) from PROJECT.md § Feature Inventory with
exactly 5 distinct, requirement-driven tests per feature = 150 test cases.

Authoritative Sources:
- ORIGINAL_REQUEST.md (R1–R5)
- PROJECT.md (§ Feature Inventory, § Interface Contracts)
- TEST_INFRA.md & DISPATCH.md
"""

import inspect
import json
import os
import re
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import inngest
import jwt
import pytest
from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Address, PlatformSetting, User
from apps.accounts.serializers import RegisterSerializer
from apps.deliveries.dispatch import (
    accept_delivery_offer,
    broadcast_delivery_offers,
    find_candidate_drivers,
    reject_delivery_offer,
)
from apps.deliveries.inngest_functions import (
    delivery_inngest_functions,
    fn_driver_offer_timeout_handler,
    fn_order_auto_dispatch_flow,
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
from apps.menus.meilisearch_service import (
    search_meilisearch,
    sync_menu_item_to_meili,
    sync_restaurant_to_meili,
)
from apps.menus.models import MenuCategory, MenuItem
from apps.notifications.services import (
    generate_centrifugo_connection_token,
    publish_centrifugo_event,
)
from apps.orders.models import Order, OrderItem
from apps.payments.models import PayoutCycle, Transaction, VendorPayout, DriverPayout, Wallet
from apps.promotions.models import Coupon, CouponUsage
from apps.restaurants.models import (
    DeliveryZone as RestaurantDeliveryZone,
    OperatingHours,
    Restaurant,
    calculate_dynamic_delivery_fee,
)
from core.inngest_client import inngest_client


# ============================================================================
# Shared Helpers
# ============================================================================

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _find_repo_root() -> Path | None:
    """Locate the FoxShop monorepo root containing app/, driver/, tager/, supervisor/."""
    candidates = [
        BACKEND_ROOT.parent,
        Path('/root/foxshop'),
    ]
    for cand in candidates:
        if (cand / 'supervisor').is_dir() and (cand / 'tager').is_dir():
            return cand
    return None


def _read_frontend_file(rel_path: str) -> str:
    """Read a frontend file from the monorepo root, skipping cleanly if unmounted in container."""
    repo_root = _find_repo_root()
    if repo_root is None:
        pytest.skip(f"Frontend directories not mounted in backend test container ({rel_path})")
    target = repo_root / rel_path
    if not target.exists():
        pytest.fail(f"Expected frontend file does not exist: {target}")
    return target.read_text(encoding='utf-8')


def _frontend_dir(app_name: str) -> Path:
    repo_root = _find_repo_root()
    if repo_root is None:
        pytest.skip(f"Frontend directories not mounted in backend test container ({app_name}/)")
    d = repo_root / app_name
    if not d.is_dir():
        pytest.fail(f"Expected frontend directory missing: {d}")
    return d


def _square_polygon(lat_min: float, lat_max: float, lng_min: float, lng_max: float):
    return [
        [lat_min, lng_min],
        [lat_min, lng_max],
        [lat_max, lng_max],
        [lat_max, lng_min],
        [lat_min, lng_min],
    ]


class _MockInngestStep:
    def __init__(self):
        self.sleeps = []
        self.runs = []

    def sleep(self, step_id, duration):
        self.sleeps.append((step_id, duration))
        return None

    def run(self, step_id, fn, *args, **kwargs):
        self.runs.append(step_id)
        return fn(*args, **kwargs)


class _MockInngestEvent:
    def __init__(self, name, data):
        self.name = name
        self.data = data


class _MockInngestContext:
    def __init__(self, name, data):
        self.event = _MockInngestEvent(name, data)
        self.step = _MockInngestStep()


def _invoke_inngest_fn(inngest_fn, event_name: str, data: dict):
    ctx = _MockInngestContext(event_name, data)
    handler = getattr(inngest_fn, '_handler', inngest_fn)
    return handler(ctx), ctx


def _create_user(role, prefix='u', is_active=True, is_staff=False):
    uid = uuid.uuid4().hex[:8]
    return User.objects.create_user(
        username=f'{prefix}_{uid}',
        password='Password123!',
        first_name='اختبار',
        last_name=prefix,
        phone_number=f'+2010{str(int(uid, 16))[:8].ljust(8, "0")}',
        role=role,
        is_active=is_active,
        is_staff=is_staff,
    )


def _create_driver_with_coords(lat=24.713600, lng=46.675300, cash_in_hand=Decimal('0.00'), is_online=True, is_busy=False):
    user = _create_user(User.Roles.DRIVER, prefix='drv')
    DriverProfile.objects.create(
        user=user,
        vehicle_type='MOTORCYCLE',
        is_online=is_online,
        is_busy=is_busy,
        current_latitude=Decimal(str(lat)),
        current_longitude=Decimal(str(lng)),
        cash_in_hand=cash_in_hand,
    )
    return user


# ============================================================================
# F1: Mass Role Escalation (M1 - R1)
# ============================================================================

@pytest.mark.django_db
class TestF01MassRoleEscalation:

    def test_f01_01_register_defaults_to_customer(self, api_client):
        uid = uuid.uuid4().hex[:8]
        res = api_client.post('/api/v1/auth/register/', {
            'username': f'cust_{uid}',
            'password': 'Password123!',
            'first_name': 'أحمد',
            'last_name': 'سالم',
            'phone_number': f'+2011{str(int(uid, 16))[:8].ljust(8, "1")}',
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['user']['role'] == User.Roles.CUSTOMER
        created = User.objects.get(username=f'cust_{uid}')
        assert created.role == User.Roles.CUSTOMER

    def test_f01_02_register_ignores_admin_role_in_payload(self, api_client):
        uid = uuid.uuid4().hex[:8]
        res = api_client.post('/api/v1/auth/register/', {
            'username': f'hacker_admin_{uid}',
            'password': 'Password123!',
            'first_name': 'مهاجم',
            'last_name': 'أدمن',
            'phone_number': f'+2012{str(int(uid, 16))[:8].ljust(8, "2")}',
            'role': 'ADMIN',
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['user']['role'] == User.Roles.CUSTOMER
        created = User.objects.get(username=f'hacker_admin_{uid}')
        assert created.role == User.Roles.CUSTOMER
        assert created.is_staff is False
        assert created.is_superuser is False

    def test_f01_03_register_ignores_ops_manager_and_supervisor_roles(self, api_client):
        for attempted_role in ('OPS_MANAGER', 'SUPERVISOR', 'MERCHANT'):
            uid = uuid.uuid4().hex[:8]
            res = api_client.post('/api/v1/auth/register/', {
                'username': f'esc_{attempted_role.lower()}_{uid}',
                'password': 'Password123!',
                'first_name': 'اختبار',
                'last_name': 'تصعيد',
                'phone_number': f'+2015{str(int(uid, 16))[:8].ljust(8, "3")}',
                'role': attempted_role,
            }, format='json')
            assert res.status_code == status.HTTP_201_CREATED
            assert res.data['user']['role'] == User.Roles.CUSTOMER
            user = User.objects.get(username=f'esc_{attempted_role.lower()}_{uid}')
            assert user.role == User.Roles.CUSTOMER
            assert user.is_ops_manager is False
            assert user.is_supervisor is False

    def test_f01_04_profile_reflects_customer_and_blocks_role_patch(self, api_client):
        uid = uuid.uuid4().hex[:8]
        reg = api_client.post('/api/v1/auth/register/', {
            'username': f'prof_{uid}',
            'password': 'Password123!',
            'first_name': 'نور',
            'last_name': 'محمد',
            'phone_number': f'+2010{str(int(uid, 16))[:8].ljust(8, "4")}',
            'role': 'ADMIN',
        }, format='json')
        assert reg.status_code == status.HTTP_201_CREATED
        access = reg.data['access']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

        prof_get = api_client.get('/api/v1/auth/profile/')
        assert prof_get.status_code == status.HTTP_200_OK
        assert prof_get.data['role'] == User.Roles.CUSTOMER

        prof_patch = api_client.patch('/api/v1/auth/profile/', {'role': 'ADMIN'}, format='json')
        assert prof_patch.status_code == status.HTTP_200_OK
        assert prof_patch.data['role'] == User.Roles.CUSTOMER

    def test_f01_05_register_serializer_excludes_role_and_denies_supervisor_api(self, api_client):
        serializer = RegisterSerializer()
        assert 'role' not in serializer.fields

        uid = uuid.uuid4().hex[:8]
        reg = api_client.post('/api/v1/auth/register/', {
            'username': f'pub_{uid}',
            'password': 'Password123!',
            'first_name': 'عميل',
            'last_name': 'عادي',
            'phone_number': f'+2011{str(int(uid, 16))[:8].ljust(8, "5")}',
            'role': 'OPS_MANAGER',
        }, format='json')
        assert reg.status_code == status.HTTP_201_CREATED
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        sup_res = api_client.get('/api/v1/supervisor/stats/')
        assert sup_res.status_code == status.HTTP_403_FORBIDDEN


# ============================================================================
# F2: Exposed Admin Credentials (M1 - R1)
# ============================================================================

@pytest.mark.django_db
class TestF02ExposedAdminCredentials:

    def test_f02_01_supervisor_frontend_has_no_hardcoded_credentials(self):
        sup_dir = _frontend_dir('supervisor') / 'src'
        forbidden_literals = ['FoxAdmin@2026', 'foxAdmin@2026']
        for ts_file in sup_dir.rglob('*.ts*'):
            content = ts_file.read_text(encoding='utf-8')
            for secret in forbidden_literals:
                assert secret not in content, f"Hardcoded admin credential {secret} found in {ts_file}"
            assert not re.search(r"password\s*[:=]\s*['\"][^'\"]+['\"]", content), (
                f"Hardcoded password literal found in {ts_file}"
            )

    def test_f02_02_supervisor_login_issues_standard_jwt_tokens(self, api_client, supervisor_user):
        res = api_client.post('/api/v1/auth/login/', {
            'username': supervisor_user.username,
            'password': 'password123',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert 'access' in res.data and res.data['access']
        assert 'refresh' in res.data and res.data['refresh']
        assert res.data['user']['role'] == User.Roles.OPS_MANAGER

    def test_f02_03_supervisor_login_rejects_invalid_credentials(self, api_client, supervisor_user):
        bad_pw = api_client.post('/api/v1/auth/login/', {
            'username': supervisor_user.username,
            'password': 'WrongPassword999!',
        }, format='json')
        assert bad_pw.status_code == status.HTTP_400_BAD_REQUEST
        assert 'access' not in (bad_pw.data or {})

        bad_user = api_client.post('/api/v1/auth/login/', {
            'username': 'admin_hardcoded_ghost',
            'password': 'FoxAdmin@2026',
        }, format='json')
        assert bad_user.status_code == status.HTTP_400_BAD_REQUEST
        assert 'access' not in (bad_user.data or {})

    def test_f02_04_supervisor_session_persistence_and_authenticated_access(self, api_client, supervisor_user):
        unauth = api_client.get('/api/v1/supervisor/stats/')
        assert unauth.status_code == status.HTTP_401_UNAUTHORIZED

        login = api_client.post('/api/v1/auth/login/', {
            'username': supervisor_user.username,
            'password': 'password123',
        }, format='json')
        assert login.status_code == status.HTTP_200_OK

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        auth_stats = api_client.get('/api/v1/supervisor/stats/')
        assert auth_stats.status_code == status.HTTP_200_OK
        assert 'fleet' in auth_stats.data

    def test_f02_05_supervisor_frontend_no_auto_login_backdoor(self):
        app_tsx = _read_frontend_file('supervisor/src/App.tsx')
        assert 'LoginModal' in app_tsx
        assert '!currentUser' in app_tsx
        # Ensure no mount-time auto-login call
        assert not re.search(r"useEffect\s*\([\s\S]{0,250}api\.login\s*\(", app_tsx), (
            "Supervisor App.tsx must not auto-login inside useEffect"
        )


# ============================================================================
# F3: Missing 401 Interceptors (M1 - R1)
# ============================================================================

@pytest.mark.django_db
class TestF03Missing401Interceptors:

    def test_f03_01_token_refresh_endpoint_valid_refresh_token(self, api_client, customer_user):
        refresh = RefreshToken.for_user(customer_user)
        res = api_client.post('/api/v1/auth/token/refresh/', {
            'refresh': str(refresh),
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert 'access' in res.data and res.data['access']

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        prof = api_client.get('/api/v1/auth/profile/')
        assert prof.status_code == status.HTTP_200_OK
        assert prof.data['username'] == customer_user.username

    def test_f03_02_expired_or_invalid_access_token_returns_401(self, api_client, customer_user):
        token = RefreshToken.for_user(customer_user).access_token
        token.set_exp(from_time=timezone.now() - timedelta(days=2), lifetime=timedelta(minutes=5))
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token)}')
        res = api_client.get('/api/v1/auth/profile/')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_f03_03_invalid_refresh_token_rejected(self, api_client):
        res = api_client.post('/api/v1/auth/token/refresh/', {
            'refresh': 'invalid.jwt.refresh.token',
        }, format='json')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_f03_04_rotated_refresh_token_accepted(self, api_client, customer_user):
        initial_refresh = str(RefreshToken.for_user(customer_user))
        first = api_client.post('/api/v1/auth/token/refresh/', {'refresh': initial_refresh}, format='json')
        assert first.status_code == status.HTTP_200_OK
        rotated_refresh = first.data.get('refresh')
        assert rotated_refresh, "Expected rotated refresh token when ROTATE_REFRESH_TOKENS=True"

        second = api_client.post('/api/v1/auth/token/refresh/', {'refresh': rotated_refresh}, format='json')
        assert second.status_code == status.HTTP_200_OK
        assert second.data.get('access')

    def test_f03_05_all_four_clients_implement_401_refresh_interceptor(self):
        client_paths = [
            'app/src/services/api.ts',
            'driver/src/services/api.ts',
            'tager/src/api/client.ts',
            'supervisor/src/api/client.ts',
        ]
        for rel_path in client_paths:
            src = _read_frontend_file(rel_path)
            assert '401' in src, f"{rel_path} missing 401 status handling"
            assert '/api/v1/auth/token/refresh/' in src, f"{rel_path} missing token refresh endpoint call"
            assert ('isRefreshing' in src or 'refreshPromise' in src), f"{rel_path} missing single-flight refresh mutex"
            assert 'auth:unauthorized' in src or 'onUnauthorized' in src, f"{rel_path} missing unauthorized fallback"


# ============================================================================
# F4: Order Wallet Balance Check (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF04OrderWalletBalanceCheck:

    def test_f04_01_wallet_order_succeeds_when_balance_sufficient(
        self, auth_customer_client, customer_wallet, restaurant, customer_address, menu_item
    ):
        assert customer_wallet.balance == Decimal('1000.00')
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Order.objects.filter(id=res.data['id']).exists()

    def test_f04_02_wallet_order_rejected_when_balance_insufficient(
        self, auth_customer_client, customer_user, restaurant, customer_address, menu_item
    ):
        Wallet.objects.update_or_create(user=customer_user, defaults={'balance': Decimal('10.00'), 'currency': 'EGP'})
        initial_count = Order.objects.filter(customer=customer_user).count()
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert Order.objects.filter(customer=customer_user).count() == initial_count

    def test_f04_03_wallet_order_accepted_when_balance_equals_exact_total(
        self, auth_customer_client, customer_user, restaurant, customer_address, menu_item
    ):
        fee_info = calculate_dynamic_delivery_fee(restaurant, customer_address.latitude, customer_address.longitude)
        exact_total = (menu_item.base_price * 2) + fee_info['delivery_fee']
        wallet, _ = Wallet.objects.update_or_create(
            user=customer_user, defaults={'balance': exact_total, 'currency': 'EGP'}
        )
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('0.00')

    def test_f04_04_balance_check_enforced_across_weighted_and_cod_orders(
        self, auth_customer_client, customer_user, restaurant, customer_address, weighted_menu_item, menu_item
    ):
        # 2.0 KG * 120 = 240.00 + delivery_fee (> 200.00)
        Wallet.objects.update_or_create(user=customer_user, defaults={'balance': Decimal('200.00'), 'currency': 'EGP'})
        res_weighted = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(weighted_menu_item.id), 'quantity': 1, 'requested_weight': '2.000'}],
        }, format='json')
        assert res_weighted.status_code == status.HTTP_400_BAD_REQUEST

        # COD order does NOT require wallet balance
        res_cod = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res_cod.status_code == status.HTTP_201_CREATED

    def test_f04_05_zero_balance_wallet_rejected(
        self, auth_customer_client, zero_balance_wallet, customer_user, restaurant, customer_address, menu_item
    ):
        assert zero_balance_wallet.balance == Decimal('0.00')
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert not Order.objects.filter(customer=customer_user).exists()


# ============================================================================
# F5: Atomic Wallet Deduction & Ledger (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF05AtomicWalletDeduction:

    def test_f05_01_wallet_debited_by_exact_total_on_creation(
        self, auth_customer_client, customer_wallet, restaurant, customer_address, menu_item
    ):
        start_bal = customer_wallet.balance
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        order = Order.objects.get(id=res.data['id'])
        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == start_bal - order.total_amount
        assert order.payment_status == Order.PaymentStatus.PAID

    def test_f05_02_transaction_ledger_created_with_order_payment_type(
        self, auth_customer_client, customer_wallet, restaurant, customer_address, menu_item
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        order = Order.objects.get(id=res.data['id'])
        tx = Transaction.objects.filter(
            wallet=customer_wallet,
            transaction_type=Transaction.Types.ORDER_PAYMENT,
        ).first()
        assert tx is not None
        assert tx.amount == -order.total_amount
        assert order.order_number in tx.reference_id or str(order.id) in tx.reference_id or order.order_number in tx.description

    def test_f05_03_wallet_refunded_on_order_cancellation(
        self, auth_customer_client, customer_wallet, restaurant, customer_address, menu_item
    ):
        start_bal = customer_wallet.balance
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        order_id = res.data['id']
        order = Order.objects.get(id=order_id)

        cancel_res = auth_customer_client.post(f'/api/v1/customer/orders/{order_id}/cancel/')
        assert cancel_res.status_code == status.HTTP_200_OK

        customer_wallet.refresh_from_db()
        order.refresh_from_db()
        assert customer_wallet.balance == start_bal
        assert order.payment_status == Order.PaymentStatus.REFUNDED
        refund_tx = Transaction.objects.filter(
            wallet=customer_wallet,
            transaction_type=Transaction.Types.REFUND,
        ).first()
        assert refund_tx is not None
        assert refund_tx.amount == order.total_amount

    def test_f05_04_atomic_rollback_on_order_creation_failure(
        self, auth_customer_client, customer_wallet, restaurant, customer_address, menu_item
    ):
        start_bal = customer_wallet.balance
        with patch('apps.orders.serializers.OrderItem.objects.create', side_effect=RuntimeError("Simulated DB crash")):
            with pytest.raises(RuntimeError):
                auth_customer_client.post('/api/v1/customer/orders/checkout/', {
                    'restaurant_id': str(restaurant.id),
                    'delivery_address_id': str(customer_address.id),
                    'payment_method': Order.PaymentMethod.WALLET,
                    'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
                }, format='json')

        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == start_bal
        assert not Transaction.objects.filter(wallet=customer_wallet, transaction_type=Transaction.Types.ORDER_PAYMENT).exists()

    def test_f05_05_ledger_currency_consistency(
        self, auth_customer_client, customer_wallet, restaurant, customer_address, menu_item
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        order = Order.objects.get(id=res.data['id'])
        assert order.currency == customer_wallet.currency == 'EGP'
        tx = Transaction.objects.filter(wallet=customer_wallet, transaction_type=Transaction.Types.ORDER_PAYMENT).first()
        assert tx is not None
        assert isinstance(tx.amount, Decimal)
        assert tx.amount == -order.total_amount


# ============================================================================
# F6: Variable-Weight Pre-Auth Hold (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF06VariableWeightPreAuthHold:

    def test_f06_01_card_weighted_order_calculates_15_percent_preauth_hold(
        self, auth_customer_client, restaurant, customer_address, weighted_menu_item
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.CARD,
            'items': [{'menu_item_id': str(weighted_menu_item.id), 'quantity': 1, 'requested_weight': '2.000'}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert Decimal(str(res.data['subtotal'])) == Decimal('240.00')
        assert Decimal(str(res.data['preauth_hold_amount'])) == Decimal('36.00')

    def test_f06_02_card_weighted_order_total_includes_15_percent_hold(
        self, auth_customer_client, restaurant, customer_address, weighted_menu_item
    ):
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.CARD,
            'items': [{'menu_item_id': str(weighted_menu_item.id), 'quantity': 1, 'requested_weight': '2.000'}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        sub = Decimal(str(res.data['subtotal']))
        fee = Decimal(str(res.data['delivery_fee']))
        hold = Decimal(str(res.data['preauth_hold_amount']))
        tot = Decimal(str(res.data['total_amount']))
        assert tot == sub + fee + hold

    def test_f06_03_merchant_confirm_weights_recomputes_exact_total(
        self, auth_merchant_client, order_factory, weighted_menu_item
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
            delivery_fee=Decimal('15.00'),
        )
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': '1.500'}],
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        assert order.subtotal == Decimal('180.00')
        assert order.total_amount == Decimal('195.00')
        assert order.is_weight_confirmed is True

    def test_f06_04_confirm_weights_captures_or_releases_hold_difference(
        self, auth_merchant_client, order_factory, weighted_menu_item
    ):
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('100.00'),
                'is_weighted': True,
                'requested_weight': Decimal('2.000'),
            }],
            delivery_fee=Decimal('15.00'),
        )
        # Initial hold = 30.00, total = 245.00
        assert order.preauth_hold_amount == Decimal('30.00')
        item = order.items.first()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': '2.100'}],
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        # Final total = 210.00 + 15.00 = 225.00 (less than 245.00 authorized, difference released)
        assert order.total_amount == Decimal('225.00')
        assert order.payment_status == Order.PaymentStatus.PAID

    def test_f06_05_confirm_weights_broadcasts_centrifugo_event(
        self, auth_merchant_client, order_factory, weighted_menu_item, mock_centrifugo
    ):
        order = order_factory(
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.CARD,
            items=[{
                'menu_item': weighted_menu_item,
                'quantity': 1,
                'unit_price': Decimal('100.00'),
                'is_weighted': True,
                'requested_weight': Decimal('1.000'),
            }],
        )
        item = order.items.first()
        mock_centrifugo.clear()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/confirm-weights/', {
            'items': [{'item_id': str(item.id), 'actual_weight': '1.100'}],
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        mock_centrifugo.assert_published(channel=f'orders:order_{order.id}')
        events = mock_centrifugo.filter(channel=f'orders:order_{order.id}')
        assert any(ev.get('is_weight_confirmed') is True for ev in events)


# ============================================================================
# F7: Unconstrained Wallet Top-Up (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF07UnconstrainedWalletTopUp:

    def test_f07_01_topup_exceeding_per_transaction_max_rejected(self, auth_customer_client, customer_wallet):
        initial_bal = customer_wallet.balance
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {
            'amount': '100000.00',
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        customer_wallet.refresh_from_db()
        assert customer_wallet.balance == initial_bal

    def test_f07_02_topup_exceeding_wallet_balance_ceiling_rejected(self, auth_customer_client, customer_user):
        wallet, _ = Wallet.objects.update_or_create(
            user=customer_user, defaults={'balance': Decimal('9800.00'), 'currency': 'EGP'}
        )
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {
            'amount': '1000.00',
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        wallet.refresh_from_db()
        assert wallet.balance == Decimal('9800.00')

    def test_f07_03_negative_and_zero_topup_rejected(self, auth_customer_client, customer_wallet):
        for bad_amt in ('0', '0.00', '-100.00', 'invalid'):
            res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {
                'amount': bad_amt,
            }, format='json')
            assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_f07_04_valid_topup_credits_wallet_and_creates_ledger(self, auth_customer_client, zero_balance_wallet):
        res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {
            'amount': '250.00',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        zero_balance_wallet.refresh_from_db()
        assert zero_balance_wallet.balance == Decimal('250.00')
        tx = Transaction.objects.filter(wallet=zero_balance_wallet, transaction_type=Transaction.Types.TOPUP).first()
        assert tx is not None
        assert tx.amount == Decimal('250.00')

    def test_f07_05_daily_cumulative_topup_cap_enforced(self, auth_customer_client, zero_balance_wallet):
        # Multiple top-ups within the same day attempting to exceed daily cumulative cap
        accepted_total = Decimal('0.00')
        rejected = False
        for _ in range(15):
            res = auth_customer_client.post('/api/v1/customer/payments/wallet/topup/', {
                'amount': '1000.00',
            }, format='json')
            if res.status_code == status.HTTP_200_OK:
                accepted_total += Decimal('1000.00')
            else:
                assert res.status_code == status.HTTP_400_BAD_REQUEST
                rejected = True
                break
        assert rejected, f"Daily cumulative top-up cap was never enforced even after {accepted_total} EGP!"


# ============================================================================
# F8: Weekly Payouts & COD Accounting (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF08WeeklyPayoutsAndCODAccounting:

    def _run_weekly_payouts(self):
        from apps.payments import tasks as pay_tasks
        fn = getattr(pay_tasks, 'generate_weekly_payouts', None)
        if fn is None:
            from apps.deliveries.inngest_functions import fn_weekly_vendor_payouts_cron
            res, _ = _invoke_inngest_fn(fn_weekly_vendor_payouts_cron, 'inngest/scheduled.timer', {})
            return res
        if hasattr(fn, '_handler'):
            res, _ = _invoke_inngest_fn(fn, 'inngest/scheduled.timer', {})
            return res
        return fn()

    def test_f08_01_vendor_payouts_exclude_cod_orders(
        self, restaurant, order_factory
    ):
        last_week_dt = timezone.now() - timedelta(days=7)
        # Non-COD (CARD) delivered order: subtotal 200
        card_order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(id=card_order.id).update(
            subtotal=Decimal('200.00'), total_amount=Decimal('215.00'), created_at=last_week_dt
        )
        # COD delivered order: subtotal 300
        cod_order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.COD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(id=cod_order.id).update(
            subtotal=Decimal('300.00'), total_amount=Decimal('315.00'), created_at=last_week_dt
        )

        self._run_weekly_payouts()
        vp = VendorPayout.objects.filter(restaurant=restaurant).first()
        assert vp is not None
        # Vendor payout must NOT pay out the 300.00 COD cash to merchant (gross/net must reflect non-COD exclusion)
        assert vp.gross_sales == Decimal('200.00') or vp.net_payout < Decimal('200.00')

    def test_f08_02_driver_cash_handover_verified_via_shift_settlement(
        self, restaurant, driver_user, order_factory, shift_settlement_factory
    ):
        last_week_dt = timezone.now() - timedelta(days=7)
        cod_order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.COD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(id=cod_order.id).update(
            subtotal=Decimal('200.00'), delivery_fee=Decimal('20.00'), total_amount=Decimal('220.00'), created_at=last_week_dt
        )
        DeliveryTrip.objects.create(
            order=cod_order,
            driver=driver_user,
            status=DeliveryTrip.Status.COMPLETED,
            driver_earnings=Decimal('20.00'),
            completed_at=last_week_dt,
        )
        # Driver already handed over the COD cash via ShiftSettlement
        shift_settlement_factory(
            restaurant_instance=restaurant,
            driver=driver_user,
            orders=[cod_order],
            total_goods_amount=Decimal('200.00'),
            platform_commission_amount=Decimal('30.00'),
            status=ShiftSettlement.Status.COMPLETED,
            settled_at=last_week_dt,
        )

        self._run_weekly_payouts()
        dp = DriverPayout.objects.filter(driver=driver_user).first()
        assert dp is not None
        # Handed-over COD cash must NOT leave driver with -200 debt
        assert dp.net_balance >= Decimal('0.00') or dp.cod_cash_collected == Decimal('0.00')

    def test_f08_03_weekly_payout_workflow_in_inngest_not_celery(self):
        tasks_path = BACKEND_ROOT / 'apps' / 'payments' / 'tasks.py'
        if tasks_path.exists():
            content = tasks_path.read_text(encoding='utf-8')
            assert '@shared_task' not in content
            assert 'from celery' not in content and 'import celery' not in content
        fn_ids = [f.id for f in delivery_inngest_functions]
        assert any('payout' in fid for fid in fn_ids)

    def test_f08_04_platform_net_commission_calculation(self, restaurant, order_factory):
        last_week_dt = timezone.now() - timedelta(days=7)
        ps = PlatformSetting.get_settings()
        ps.platform_commission_percent = Decimal('15.00')
        ps.save()

        card_order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(id=card_order.id).update(
            subtotal=Decimal('1000.00'), total_amount=Decimal('1015.00'), created_at=last_week_dt
        )

        self._run_weekly_payouts()
        vp = VendorPayout.objects.filter(restaurant=restaurant).first()
        assert vp is not None
        assert vp.commission_amount == Decimal('150.00')
        assert vp.net_payout == Decimal('850.00')

    def test_f08_05_double_deduction_prevention_on_repeated_payout_run(self, restaurant, order_factory):
        last_week_dt = timezone.now() - timedelta(days=7)
        card_order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(id=card_order.id).update(
            subtotal=Decimal('500.00'), total_amount=Decimal('515.00'), created_at=last_week_dt
        )

        self._run_weekly_payouts()
        first_net = VendorPayout.objects.get(restaurant=restaurant).net_payout
        self._run_weekly_payouts()
        assert VendorPayout.objects.filter(restaurant=restaurant).count() == 1
        second_net = VendorPayout.objects.get(restaurant=restaurant).net_payout
        assert first_net == second_net


# ============================================================================
# F9: Duplicate Commission Extraction (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF09DuplicateCommissionExtraction:

    def test_f09_01_store_own_fleet_commission_deducted_once_on_delivery(
        self, auth_merchant_client, merchant_user, restaurant, order_factory
    ):
        restaurant.delivery_mode = Restaurant.DeliveryMode.STORE_OWN_FLEET
        restaurant.save(update_fields=['delivery_mode'])
        merchant_wallet, _ = Wallet.objects.get_or_create(
            user=merchant_user, defaults={'balance': Decimal('500.00'), 'currency': 'EGP'}
        )
        order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.COD,
        )
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.DELIVERED,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        merchant_wallet.refresh_from_db()
        assert merchant_wallet.balance < Decimal('500.00')
        assert Transaction.objects.filter(wallet=merchant_wallet).count() == 1

    def test_f09_02_repeated_delivered_transition_does_not_duplicate_commission(
        self, auth_merchant_client, merchant_user, restaurant, order_factory
    ):
        restaurant.delivery_mode = Restaurant.DeliveryMode.STORE_OWN_FLEET
        restaurant.save(update_fields=['delivery_mode'])
        merchant_wallet, _ = Wallet.objects.get_or_create(
            user=merchant_user, defaults={'balance': Decimal('500.00'), 'currency': 'EGP'}
        )
        order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.COD,
        )
        res1 = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.DELIVERED,
        }, format='json')
        assert res1.status_code == status.HTTP_200_OK
        merchant_wallet.refresh_from_db()
        bal_after_first = merchant_wallet.balance

        res2 = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.DELIVERED,
        }, format='json')
        assert res2.status_code in (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST)
        merchant_wallet.refresh_from_db()
        assert merchant_wallet.balance == bal_after_first
        assert Transaction.objects.filter(wallet=merchant_wallet).count() == 1

    def test_f09_03_is_commission_deducted_flag_set_and_checked(
        self, auth_merchant_client, merchant_user, restaurant, order_factory
    ):
        restaurant.delivery_mode = Restaurant.DeliveryMode.STORE_OWN_FLEET
        restaurant.save(update_fields=['delivery_mode'])
        Wallet.objects.get_or_create(user=merchant_user, defaults={'balance': Decimal('500.00'), 'currency': 'EGP'})
        order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.COD,
        )
        assert hasattr(order, 'is_commission_deducted'), "Order must define is_commission_deducted field"
        assert order.is_commission_deducted is False

        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.DELIVERED,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        assert order.is_commission_deducted is True

    def test_f09_04_non_fleet_orders_excluded_from_store_own_fleet_commission(
        self, auth_merchant_client, merchant_user, restaurant, order_factory
    ):
        restaurant.delivery_mode = Restaurant.DeliveryMode.PLATFORM_MANAGED
        restaurant.save(update_fields=['delivery_mode'])
        merchant_wallet, _ = Wallet.objects.get_or_create(
            user=merchant_user, defaults={'balance': Decimal('500.00'), 'currency': 'EGP'}
        )
        order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.CONFIRMED,
            payment_method=Order.PaymentMethod.COD,
        )
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.READY_FOR_PICKUP,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        merchant_wallet.refresh_from_db()
        assert merchant_wallet.balance == Decimal('500.00')
        assert Transaction.objects.filter(wallet=merchant_wallet).count() == 0

    def test_f09_05_commission_deduction_creates_audit_transaction_record(
        self, auth_merchant_client, merchant_user, restaurant, order_factory
    ):
        restaurant.delivery_mode = Restaurant.DeliveryMode.STORE_OWN_FLEET
        restaurant.save(update_fields=['delivery_mode'])
        merchant_wallet, _ = Wallet.objects.get_or_create(
            user=merchant_user, defaults={'balance': Decimal('500.00'), 'currency': 'EGP'}
        )
        order = order_factory(
            restaurant_instance=restaurant,
            status=Order.Status.ON_THE_WAY,
            payment_method=Order.PaymentMethod.COD,
        )
        auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.DELIVERED,
        }, format='json')
        tx = Transaction.objects.filter(wallet=merchant_wallet).first()
        assert tx is not None
        assert tx.amount < Decimal('0.00')
        assert order.order_number in tx.description or str(order.id)[:8] in tx.reference_id


# ============================================================================
# F10: Supervisor Cash Settlement Cap (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF10SupervisorCashSettlementCap:

    def test_f10_01_daily_cumulative_cap_enforced_for_supervisor(
        self, authenticated_client, driver_user
    ):
        ps = PlatformSetting.get_settings()
        ps.supervisor_max_settlement_limit = Decimal('500.00')
        ps.save()

        sup = _create_user(User.Roles.SUPERVISOR, prefix='sup_cap', is_staff=True)
        sup_client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('800.00')
        profile.save(update_fields=['cash_in_hand'])

        res1 = sup_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 300,
        }, format='json')
        assert res1.status_code == status.HTTP_200_OK
        assert res1.data['status'] == 'APPROVED'

        # Second same-day settlement pushes cumulative total to 600 > 500 cap
        res2 = sup_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 300,
        }, format='json')
        assert res2.status_code == status.HTTP_400_BAD_REQUEST or res2.data.get('status') == 'PENDING_APPROVAL'
        approved_today = DriverCashSettlement.objects.filter(
            supervisor=sup, status=DriverCashSettlement.Status.APPROVED
        )
        assert sum(s.amount for s in approved_today) <= Decimal('500.00')

    def test_f10_02_single_settlement_exceeding_cap_not_auto_approved(
        self, authenticated_client, driver_user
    ):
        ps = PlatformSetting.get_settings()
        ps.supervisor_max_settlement_limit = Decimal('500.00')
        ps.save()

        sup = _create_user(User.Roles.SUPERVISOR, prefix='sup_single', is_staff=True)
        sup_client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('700.00')
        profile.save(update_fields=['cash_in_hand'])

        res = sup_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 600,
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST or res.data.get('status') == 'PENDING_APPROVAL'
        profile.refresh_from_db()
        assert profile.cash_in_hand == Decimal('700.00')

    def test_f10_03_multiple_small_settlements_cannot_evade_daily_cap(
        self, authenticated_client, driver_user
    ):
        ps = PlatformSetting.get_settings()
        ps.supervisor_max_settlement_limit = Decimal('500.00')
        ps.save()

        sup = _create_user(User.Roles.SUPERVISOR, prefix='sup_split', is_staff=True)
        sup_client = authenticated_client(sup)

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('900.00')
        profile.save(update_fields=['cash_in_hand'])

        for _ in range(2):
            r = sup_client.post('/api/v1/supervisor/cash/settle/', {
                'driver_id': str(driver_user.id),
                'amount': 200,
            }, format='json')
            assert r.status_code == status.HTTP_200_OK
            assert r.data['status'] == 'APPROVED'

        # 3rd split (200 + 200 + 200 = 600 > 500) must be blocked/escalated
        r3 = sup_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 200,
        }, format='json')
        assert r3.status_code == status.HTTP_400_BAD_REQUEST or r3.data.get('status') == 'PENDING_APPROVAL'

    def test_f10_04_daily_cap_resets_on_new_day(self, authenticated_client, driver_user):
        ps = PlatformSetting.get_settings()
        ps.supervisor_max_settlement_limit = Decimal('500.00')
        ps.save()

        sup = _create_user(User.Roles.SUPERVISOR, prefix='sup_reset', is_staff=True)
        sup_client = authenticated_client(sup)

        old_s = DriverCashSettlement.objects.create(
            driver=driver_user,
            supervisor=sup,
            amount=Decimal('500.00'),
            balance_before=Decimal('800.00'),
            balance_after=Decimal('300.00'),
            status=DriverCashSettlement.Status.APPROVED,
        )
        DriverCashSettlement.objects.filter(id=old_s.id).update(
            created_at=timezone.now() - timedelta(days=1, hours=1)
        )

        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('300.00')
        profile.save(update_fields=['cash_in_hand'])

        res = sup_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 300,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'APPROVED'

    def test_f10_05_settlement_records_supervisor_audit_trail(
        self, auth_supervisor_client, supervisor_user, driver_user
    ):
        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('250.00')
        profile.save(update_fields=['cash_in_hand'])

        res = auth_supervisor_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 250,
            'notes': 'توريد نهاية الوردية',
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        log = SupervisorActionLog.objects.filter(
            actor=supervisor_user,
            action_type=SupervisorActionLog.ActionType.CASH_SETTLED,
        ).first()
        assert log is not None


# ============================================================================
# F11: Driver Wallet API Endpoints (M2 - R2)
# ============================================================================

@pytest.mark.django_db
class TestF11DriverWalletAPIEndpoints:

    def test_f11_01_driver_payout_request_endpoint_creates_request(
        self, auth_driver_client, driver_wallet
    ):
        res = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': '150.00',
            'note': 'InstaPay withdrawal',
        }, format='json')
        assert res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_f11_02_driver_cash_deposit_endpoint_records_deposit(
        self, auth_driver_client, driver_user, driver_wallet
    ):
        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('300.00')
        profile.save(update_fields=['cash_in_hand'])

        res = auth_driver_client.post('/api/v1/driver/wallet/cash-deposit/', {
            'amount': '200.00',
            'reference_number': 'FW-99881',
        }, format='json')
        assert res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_f11_03_driver_wallet_transactions_endpoint_lists_history(
        self, auth_driver_client, driver_wallet, customer_wallet
    ):
        Transaction.objects.create(
            wallet=driver_wallet,
            amount=Decimal('75.00'),
            transaction_type=Transaction.Types.PAYOUT,
            reference_id='DRV-TX-1',
            description='أرباح توصيل',
        )
        Transaction.objects.create(
            wallet=customer_wallet,
            amount=Decimal('99.00'),
            transaction_type=Transaction.Types.TOPUP,
            reference_id='CUST-TX-OTHER',
            description='عميل آخر',
        )

        res = auth_driver_client.get('/api/v1/driver/wallet/transactions/')
        assert res.status_code == status.HTTP_200_OK
        items = res.data if isinstance(res.data, list) else res.data.get('transactions', res.data.get('results', []))
        refs = [str(item.get('reference_id', '')) for item in items]
        assert 'DRV-TX-1' in refs
        assert 'CUST-TX-OTHER' not in refs

    def test_f11_04_driver_payout_request_rejects_excessive_or_invalid_amount(
        self, auth_driver_client, driver_wallet
    ):
        res_over = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': '9999.00',
            'note': 'Over balance',
        }, format='json')
        assert res_over.status_code == status.HTTP_400_BAD_REQUEST

        res_neg = auth_customer_bad = auth_driver_client.post('/api/v1/driver/wallet/payout-request/', {
            'amount': '-10.00',
            'note': 'Negative',
        }, format='json')
        assert res_neg.status_code == status.HTTP_400_BAD_REQUEST

    def test_f11_05_driver_wallet_frontend_connects_to_live_api(self):
        wallet_tsx = _read_frontend_file('driver/src/app/(tabs)/wallet.tsx')
        assert '/api/v1/driver/wallet/payout-request/' in wallet_tsx
        assert '/api/v1/driver/wallet/cash-deposit/' in wallet_tsx


# ============================================================================
# F12: Collision-Free Order Number (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF12CollisionFreeOrderNumber:

    def test_f12_01_order_number_follows_fox_convention(self, order_factory):
        order = order_factory()
        assert order.order_number.startswith('FOX-')
        assert len(order.order_number) >= 10

    def test_f12_02_order_number_uniqueness_across_large_batch(self, order_factory):
        numbers = {order_factory().order_number for _ in range(100)}
        assert len(numbers) == 100

    def test_f12_03_order_number_not_bounded_6_digit_random(self, order_factory):
        order_models_src = inspect.getsource(Order.save)
        assert 'random.randint(100000, 999999)' not in order_models_src, (
            "Order.save() must replace bounded 6-digit random.randint with collision-free scheme"
        )
        order = order_factory()
        suffix = order.order_number.replace('FOX-', '')
        assert len(suffix) >= 8 or suffix.isdigit()

    def test_f12_04_no_integrity_error_on_rapid_order_creation(
        self, customer_user, restaurant, customer_address
    ):
        created_ids = []
        for _ in range(25):
            o = Order.objects.create(
                customer=customer_user,
                restaurant=restaurant,
                delivery_address=customer_address,
                subtotal=Decimal('50.00'),
                delivery_fee=Decimal('10.00'),
                total_amount=Decimal('60.00'),
            )
            created_ids.append(o.order_number)
        assert len(set(created_ids)) == 25

    def test_f12_05_order_number_immutable_on_save(self, order_factory):
        order = order_factory()
        orig = order.order_number
        order.transition_to(Order.Status.CONFIRMED)
        order.refresh_from_db()
        assert order.order_number == orig


# ============================================================================
# F13: Offer Acceptance Race Condition (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF13OfferAcceptanceRaceCondition:

    def test_f13_01_offer_acceptance_locks_order_with_select_for_update(self):
        src = inspect.getsource(accept_delivery_offer)
        assert re.search(r'Order\.objects\.select_for_update\(\)', src), (
            "accept_delivery_offer must lock the Order row with Order.objects.select_for_update()"
        )

    def test_f13_02_first_driver_wins_and_trip_is_accepted(
        self, authenticated_client, order_factory
    ):
        d1 = _create_driver_with_coords()
        d2 = _create_driver_with_coords()
        order = order_factory(status=Order.Status.PREPARING)
        offers = broadcast_delivery_offers(order, [(d1, 1.0), (d2, 1.5)], batch_number=1)

        c1 = authenticated_client(d1)
        res = c1.post(f'/api/v1/driver/offers/{offers[0].id}/accept/')
        assert res.status_code == status.HTTP_200_OK
        trip = DeliveryTrip.objects.get(order=order)
        assert trip.driver == d1
        assert trip.status == DeliveryTrip.Status.ACCEPTED

    def test_f13_03_second_driver_receives_clean_4xx_no_500_crash(
        self, authenticated_client, order_factory
    ):
        d1 = _create_driver_with_coords()
        d2 = _create_driver_with_coords()
        order = order_factory(status=Order.Status.PREPARING)
        offers = broadcast_delivery_offers(order, [(d1, 1.0), (d2, 1.5)], batch_number=1)

        res1 = authenticated_client(d1).post(f'/api/v1/driver/offers/{offers[0].id}/accept/')
        assert res1.status_code == status.HTTP_200_OK

        res2 = authenticated_client(d2).post(f'/api/v1/driver/offers/{offers[1].id}/accept/')
        assert res2.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT)
        assert DeliveryTrip.objects.filter(order=order).count() == 1

    def test_f13_04_sequential_race_simulation_only_one_winner(self, order_factory):
        d1 = _create_driver_with_coords()
        d2 = _create_driver_with_coords()
        order = order_factory(status=Order.Status.PREPARING)
        offers = broadcast_delivery_offers(order, [(d1, 1.0), (d2, 1.5)], batch_number=1)

        ok1, res1 = accept_delivery_offer(offers[0].id, d1)
        ok2, res2 = accept_delivery_offer(offers[1].id, d2)
        assert ok1 is True and isinstance(res1, DeliveryTrip)
        assert ok2 is False and isinstance(res2, str)

    def test_f13_05_competing_offers_marked_expired_and_winner_busy(self, order_factory):
        d1 = _create_driver_with_coords()
        d2 = _create_driver_with_coords()
        order = order_factory(status=Order.Status.PREPARING)
        offers = broadcast_delivery_offers(order, [(d1, 1.0), (d2, 1.5)], batch_number=1)

        accept_delivery_offer(offers[0].id, d1)
        offers[0].refresh_from_db()
        offers[1].refresh_from_db()
        d1.driver_profile.refresh_from_db()
        assert offers[0].status == DeliveryOffer.Status.ACCEPTED
        assert offers[1].status == DeliveryOffer.Status.EXPIRED
        assert d1.driver_profile.is_busy is True


# ============================================================================
# F14: Batch Driver Exclusion (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF14BatchDriverExclusion:

    def test_f14_01_timed_out_drivers_excluded_from_subsequent_batch(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        cache.clear()
        DriverProfile.objects.all().delete()
        d1 = _create_driver_with_coords(lat=24.7136, lng=46.6753)
        d2 = _create_driver_with_coords(lat=24.7250, lng=46.6850)
        order = order_factory(status=Order.Status.PREPARING)

        DeliveryOffer.objects.create(
            order=order,
            driver=d1,
            batch_number=1,
            status=DeliveryOffer.Status.PENDING,
            expires_at=timezone.now() - timedelta(seconds=5),
        )
        _invoke_inngest_fn(
            fn_driver_offer_timeout_handler,
            'delivery/offers.broadcasted',
            {'order_id': str(order.id), 'batch': 1, 'timeout_seconds': 45},
        )
        batch2_driver_ids = list(
            DeliveryOffer.objects.filter(order=order, batch_number=2).values_list('driver_id', flat=True)
        )
        assert d1.id not in batch2_driver_ids
        assert d2.id in batch2_driver_ids

    def test_f14_02_declining_drivers_excluded_from_subsequent_batch(
        self, authenticated_client, order_factory
    ):
        cache.clear()
        DriverProfile.objects.all().delete()
        d1 = _create_driver_with_coords(lat=24.7136, lng=46.6753)
        d2 = _create_driver_with_coords(lat=24.7200, lng=46.6800)
        order = order_factory(status=Order.Status.PREPARING)
        offers = broadcast_delivery_offers(order, [(d1, 0.5)], batch_number=1)

        res = authenticated_client(d1).post(f'/api/v1/driver/offers/{offers[0].id}/reject/')
        assert res.status_code == status.HTTP_200_OK

        candidates = find_candidate_drivers(order, radius_km=10.0, limit=5)
        candidate_ids = [u.id for u, _ in candidates]
        assert d1.id not in candidate_ids
        assert d2.id in candidate_ids

    def test_f14_03_radius_escalation_in_batch_2_and_3(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        cache.clear()
        DriverProfile.objects.all().delete()
        # d_far ~ 12 km away from restaurant (24.7136, 46.6753): +0.108 lat ~ 12.0 km
        d_near = _create_driver_with_coords(lat=24.7136, lng=46.6753)
        d_far = _create_driver_with_coords(lat=24.8220, lng=46.6753)
        order = order_factory(status=Order.Status.PREPARING)

        # Batch 1 & Batch 2 timeout without accepting; d_far is outside 10km, inside 15km
        DeliveryOffer.objects.create(
            order=order, driver=d_near, batch_number=1,
            status=DeliveryOffer.Status.TIMED_OUT, expires_at=timezone.now() - timedelta(seconds=10),
        )
        DeliveryOffer.objects.create(
            order=order, driver=d_near, batch_number=2,
            status=DeliveryOffer.Status.PENDING, expires_at=timezone.now() - timedelta(seconds=5),
        )
        _invoke_inngest_fn(
            fn_driver_offer_timeout_handler,
            'delivery/offers.broadcasted',
            {'order_id': str(order.id), 'batch': 2, 'timeout_seconds': 45},
        )
        batch3_drivers = list(
            DeliveryOffer.objects.filter(order=order, batch_number=3).values_list('driver_id', flat=True)
        )
        assert d_far.id in batch3_drivers

    def test_f14_04_fresh_candidate_selection_excludes_rejected(self, order_factory):
        cache.clear()
        DriverProfile.objects.all().delete()
        d1 = _create_driver_with_coords(lat=24.7136, lng=46.6753)
        d2 = _create_driver_with_coords(lat=24.7160, lng=46.6770)
        order = order_factory(status=Order.Status.PREPARING)

        offers = broadcast_delivery_offers(order, [(d1, 0.1)], batch_number=1)
        reject_delivery_offer(offers[0].id, d1)
        candidates = find_candidate_drivers(order, radius_km=5.0, limit=3)
        assert [u.id for u, _ in candidates] == [d2.id]

    def test_f14_05_no_repeated_offer_broadcast_to_same_driver(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        cache.clear()
        DriverProfile.objects.all().delete()
        only_driver = _create_driver_with_coords(lat=24.7136, lng=46.6753)
        order = order_factory(status=Order.Status.PREPARING)

        DeliveryOffer.objects.create(
            order=order, driver=only_driver, batch_number=1,
            status=DeliveryOffer.Status.PENDING, expires_at=timezone.now() - timedelta(seconds=5),
        )
        _invoke_inngest_fn(
            fn_driver_offer_timeout_handler,
            'delivery/offers.broadcasted',
            {'order_id': str(order.id), 'batch': 1, 'timeout_seconds': 45},
        )
        assert DeliveryOffer.objects.filter(order=order, driver=only_driver).count() == 1


# ============================================================================
# F15: Cancelled Order Sleep Check (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF15CancelledOrderSleepCheck:

    def test_f15_01_inngest_prep_flow_aborts_when_order_cancelled_after_sleep(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        _create_driver_with_coords()
        order = order_factory(status=Order.Status.CANCELLED)
        res, _ = _invoke_inngest_fn(
            fn_order_auto_dispatch_flow,
            'order/prep.scheduled',
            {'order_id': str(order.id), 'prep_minutes': 20},
        )
        assert DeliveryOffer.objects.filter(order=order).count() == 0
        assert res.get('status') in ('cancelled', 'order_cancelled', 'aborted_cancelled', 'skipped_cancelled')

    def test_f15_02_inngest_prep_flow_aborts_on_delivered_or_rejected_order(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        _create_driver_with_coords()
        order = order_factory(status=Order.Status.DELIVERED)
        _invoke_inngest_fn(
            fn_order_auto_dispatch_flow,
            'order/prep.scheduled',
            {'order_id': str(order.id), 'prep_minutes': 15},
        )
        assert DeliveryOffer.objects.filter(order=order).count() == 0

    def test_f15_03_inngest_prep_flow_proceeds_when_order_preparing(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        DriverProfile.objects.all().delete()
        _create_driver_with_coords()
        order = order_factory(status=Order.Status.PREPARING)
        res, _ = _invoke_inngest_fn(
            fn_order_auto_dispatch_flow,
            'order/prep.scheduled',
            {'order_id': str(order.id), 'prep_minutes': 15},
        )
        assert res.get('status') == 'broadcasted'
        assert DeliveryOffer.objects.filter(order=order).count() >= 1

    def test_f15_04_timeout_handler_aborts_if_order_cancelled(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        _create_driver_with_coords()
        order = order_factory(status=Order.Status.CANCELLED)
        _invoke_inngest_fn(
            fn_driver_offer_timeout_handler,
            'delivery/offers.broadcasted',
            {'order_id': str(order.id), 'batch': 1, 'timeout_seconds': 45},
        )
        assert DeliveryOffer.objects.filter(order=order).count() == 0

    def test_f15_05_cancellation_publishes_order_channel_event(
        self, auth_customer_client, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PENDING)
        mock_centrifugo.clear()
        res = auth_customer_client.post(f'/api/v1/customer/orders/{order.id}/cancel/')
        assert res.status_code == status.HTTP_200_OK
        mock_centrifugo.assert_published(channel=f'orders:order_{order.id}')


# ============================================================================
# F16: Coupon Usage Restoration (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF16CouponUsageRestoration:

    def _make_coupon(self, code='SAVE20', max_usage=1):
        return Coupon.objects.create(
            code=code,
            discount_type=Coupon.DiscountTypes.FLAT,
            discount_value=Decimal('20.00'),
            min_order_amount=Decimal('30.00'),
            is_active=True,
            valid_from=timezone.now() - timedelta(days=1),
            valid_to=timezone.now() + timedelta(days=7),
            max_usage_per_user=max_usage,
        )

    def test_f16_01_customer_cancellation_clears_coupon_usage(
        self, auth_customer_client, customer_user, restaurant, customer_address, menu_item
    ):
        coupon = self._make_coupon(code=f'CANC{uuid.uuid4().hex[:4].upper()}')
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1

        cancel_res = auth_customer_client.post(f"/api/v1/customer/orders/{res.data['id']}/cancel/")
        assert cancel_res.status_code == status.HTTP_200_OK
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0

    def test_f16_02_merchant_rejection_clears_coupon_usage(
        self, auth_customer_client, auth_merchant_client, customer_user, restaurant, customer_address, menu_item
    ):
        coupon = self._make_coupon(code=f'REJ{uuid.uuid4().hex[:4].upper()}')
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED

        rej_res = auth_merchant_client.post(f"/api/v1/merchant/orders/{res.data['id']}/status/", {
            'status': Order.Status.CANCELLED,
            'reason': 'نفاد المكونات',
        }, format='json')
        assert rej_res.status_code == status.HTTP_200_OK
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 0

    def test_f16_03_restored_coupon_can_be_reused_on_new_order(
        self, auth_customer_client, restaurant, customer_address, menu_item
    ):
        coupon = self._make_coupon(code=f'REUSE{uuid.uuid4().hex[:4].upper()}', max_usage=1)
        first = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert first.status_code == status.HTTP_201_CREATED

        auth_customer_client.post(f"/api/v1/customer/orders/{first.data['id']}/cancel/")

        second = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert second.status_code == status.HTTP_201_CREATED

    def test_f16_04_delivered_order_retains_coupon_usage(
        self, auth_customer_client, customer_user, restaurant, customer_address, menu_item
    ):
        coupon = self._make_coupon(code=f'DONE{uuid.uuid4().hex[:4].upper()}', max_usage=1)
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        Order.objects.get(id=res.data['id']).transition_to(Order.Status.DELIVERED)

        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1
        second = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert second.status_code == status.HTTP_400_BAD_REQUEST

    def test_f16_05_partial_usage_accounting_with_multiple_max_uses(
        self, auth_customer_client, customer_user, restaurant, customer_address, menu_item
    ):
        coupon = self._make_coupon(code=f'MULTI{uuid.uuid4().hex[:4].upper()}', max_usage=2)
        o1 = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        o2 = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert o1.status_code == 201 and o2.status_code == 201
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 2

        auth_customer_client.post(f"/api/v1/customer/orders/{o1.data['id']}/cancel/")
        assert CouponUsage.objects.filter(coupon=coupon, user=customer_user).count() == 1

        o3 = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'coupon_code': coupon.code,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert o3.status_code == status.HTTP_201_CREATED


# ============================================================================
# F17: Contactless Delivery Proof (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF17ContactlessDeliveryProof:

    def _make_active_trip(self, order_factory, driver_user):
        order = order_factory(status=Order.Status.ON_THE_WAY)
        return DeliveryTrip.objects.create(
            order=order,
            driver=driver_user,
            status=DeliveryTrip.Status.PICKED_UP,
            driver_earnings=Decimal('12.00'),
        )

    def test_f17_01_contactless_delivery_requires_pod_photo(
        self, auth_driver_client, order_factory, driver_user
    ):
        trip = self._make_active_trip(order_factory, driver_user)
        res = auth_driver_client.post(f'/api/v1/driver/trips/{trip.id}/verify-otp/', {
            'is_contactless': True,
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        trip.refresh_from_db()
        assert trip.status != DeliveryTrip.Status.COMPLETED

    def test_f17_02_contactless_delivery_rejects_empty_photo_value(
        self, auth_driver_client, order_factory, driver_user
    ):
        trip = self._make_active_trip(order_factory, driver_user)
        res = auth_driver_client.post(f'/api/v1/driver/trips/{trip.id}/verify-otp/', {
            'is_contactless': True,
            'pod_photo': '',
            'proof_photo': '',
            'photo': '',
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_f17_03_contactless_delivery_accepts_valid_photo_upload(
        self, auth_driver_client, order_factory, driver_user
    ):
        trip = self._make_active_trip(order_factory, driver_user)
        # Minimal valid 1x1 JPEG bytes
        fake_img = SimpleUploadedFile('pod.jpg', b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9', content_type='image/jpeg')
        res = auth_driver_client.post(f'/api/v1/driver/trips/{trip.id}/verify-otp/', {
            'is_contactless': 'true',
            'pod_photo': fake_img,
        }, format='multipart')
        assert res.status_code == status.HTTP_200_OK

    def test_f17_04_contactless_delivery_updates_trip_and_order_completed(
        self, auth_driver_client, order_factory, driver_user
    ):
        trip = self._make_active_trip(order_factory, driver_user)
        fake_img = SimpleUploadedFile('pod_done.jpg', b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9', content_type='image/jpeg')
        res = auth_driver_client.post(f'/api/v1/driver/trips/{trip.id}/verify-otp/', {
            'is_contactless': 'true',
            'pod_photo': fake_img,
        }, format='multipart')
        assert res.status_code == status.HTTP_200_OK
        trip.refresh_from_db()
        trip.order.refresh_from_db()
        driver_user.driver_profile.refresh_from_db()
        assert trip.status == DeliveryTrip.Status.COMPLETED
        assert trip.order.status == Order.Status.DELIVERED
        assert driver_user.driver_profile.is_busy is False

    def test_f17_05_pod_photo_persisted_on_delivery_record(
        self, auth_driver_client, order_factory, driver_user
    ):
        trip = self._make_active_trip(order_factory, driver_user)
        fake_img = SimpleUploadedFile('door_proof.jpg', b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9', content_type='image/jpeg')
        res = auth_driver_client.post(f'/api/v1/driver/trips/{trip.id}/verify-otp/', {
            'is_contactless': 'true',
            'pod_photo': fake_img,
        }, format='multipart')
        assert res.status_code == status.HTTP_200_OK
        trip.refresh_from_db()
        photo_val = (
            getattr(trip, 'pod_photo', None)
            or getattr(trip, 'proof_photo', None)
            or getattr(trip, 'delivery_photo', None)
            or getattr(trip, 'proof_of_delivery_photo', None)
        )
        assert bool(photo_val), "POD photo must be stored on DeliveryTrip record"


# ============================================================================
# F18: DeliveryZone Reconciliation (M3 - R3)
# ============================================================================

@pytest.mark.django_db
class TestF18DeliveryZoneReconciliation:

    def test_f18_01_restaurant_and_operations_delivery_zone_reconciled(self, egp_currency):
        # Either unified model or explicit relational link (e.g., operational_zone / restaurant_zone)
        unified = RestaurantDeliveryZone is OpsDeliveryZone
        has_link = any(
            f.related_model in (OpsDeliveryZone, RestaurantDeliveryZone)
            for f in (RestaurantDeliveryZone._meta.get_fields() + OpsDeliveryZone._meta.get_fields())
            if getattr(f, 'is_relation', False)
        )
        assert unified or has_link, (
            "Restaurant DeliveryZone and Operations DeliveryZone must be unified or relationally linked"
        )

    def test_f18_02_delivery_address_within_zone_accepted(
        self, auth_customer_client, restaurant, customer_address, menu_item, egp_currency
    ):
        zone = RestaurantDeliveryZone.objects.create(
            name='زون الرياض الوسطى',
            city='الرياض',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        restaurant.delivery_zones.add(zone)
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED

    def test_f18_03_delivery_address_outside_zone_rejected(
        self, auth_customer_client, customer_user, restaurant, menu_item, egp_currency
    ):
        zone = RestaurantDeliveryZone.objects.create(
            name='زون محصور',
            city='الرياض',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7200, 46.6600, 46.6800),
            is_active=True,
        )
        restaurant.delivery_zones.add(zone)
        far_addr = Address.objects.create(
            user=customer_user,
            title='خارج النطاق',
            street='حي بعيد',
            latitude=Decimal('24.900000'),
            longitude=Decimal('46.900000'),
        )
        res = auth_customer_client.post('/api/v1/customer/orders/checkout/', {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(far_addr.id),
            'payment_method': Order.PaymentMethod.COD,
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 2}],
        }, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_f18_04_zone_polygon_containment_accuracy(self, egp_currency):
        zone = RestaurantDeliveryZone.objects.create(
            name='مربع الاختبار',
            city='الرياض',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7400, 46.6500, 46.7000),
            is_active=True,
        )
        assert zone.contains_point(24.7200, 46.6750) is True
        assert zone.contains_point(24.8000, 46.6750) is False
        assert zone.contains_point(24.7200, 46.7500) is False

    def test_f18_05_cross_zone_fee_calculation_applies_matched_zone(self, restaurant, egp_currency):
        zone_a = RestaurantDeliveryZone.objects.create(
            name='زون أ',
            city='الرياض',
            currency=egp_currency,
            base_delivery_fee=Decimal('18.00'),
            max_delivery_fee=Decimal('30.00'),
            polygon_coordinates=_square_polygon(24.7000, 24.7200, 46.6600, 46.6800),
            is_active=True,
        )
        restaurant.delivery_zones.add(zone_a)
        fee_info = calculate_dynamic_delivery_fee(restaurant, 24.7150, 46.6760)
        assert fee_info['zone'] == zone_a
        assert fee_info['delivery_fee'] >= Decimal('18.00')


# ============================================================================
# F19: Inngest Background Tasks Unification (M4 - R4)
# ============================================================================

@pytest.mark.django_db
class TestF19InngestBackgroundTasks:

    def test_f19_01_zero_celery_shared_task_or_imports_in_backend(self):
        assert not (BACKEND_ROOT / 'core' / 'celery.py').exists(), "core/celery.py must be removed"
        for py_file in list((BACKEND_ROOT / 'apps').rglob('*.py')) + list((BACKEND_ROOT / 'core').rglob('*.py')):
            content = py_file.read_text(encoding='utf-8')
            assert '@shared_task' not in content, f"@shared_task still present in {py_file}"
            assert not re.search(r'^\s*(from\s+celery|import\s+celery)', content, re.MULTILINE), (
                f"Celery import still present in {py_file}"
            )

    def test_f19_02_celery_removed_from_requirements_and_settings(self):
        reqs = (BACKEND_ROOT / 'requirements.txt').read_text(encoding='utf-8').lower()
        assert 'celery' not in reqs, "celery must be removed from requirements.txt"
        settings_txt = (BACKEND_ROOT / 'core' / 'settings.py').read_text(encoding='utf-8')
        assert 'CELERY_BROKER_URL' not in settings_txt

    def test_f19_03_inngest_functions_registered_and_endpoint_mounted(self, api_client):
        from core import urls as core_urls
        fn_ids = {f.id for f in delivery_inngest_functions}
        assert len(fn_ids) >= 3
        assert any('auto-dispatch' in fid for fid in fn_ids)
        assert any('timeout' in fid for fid in fn_ids)
        route_patterns = [str(p.pattern) for p in core_urls.urlpatterns]
        assert any('inngest' in pat for pat in route_patterns)

    def test_f19_04_order_status_transition_sends_inngest_event(
        self, auth_merchant_client, restaurant, order_factory, mock_inngest
    ):
        restaurant.delivery_mode = Restaurant.DeliveryMode.PLATFORM_MANAGED
        restaurant.save(update_fields=['delivery_mode'])
        order = order_factory(restaurant_instance=restaurant, status=Order.Status.PENDING)
        mock_inngest.clear()

        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.PREPARING,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        mock_inngest.assert_sent(name='order/prep.scheduled', count=1)
        assert mock_inngest.events[0].data['order_id'] == str(order.id)

    def test_f19_05_inngest_functions_use_durable_step_handlers(self):
        for fn in (fn_order_auto_dispatch_flow, fn_driver_offer_timeout_handler):
            handler = getattr(fn, '_handler', fn)
            src = inspect.getsource(handler)
            assert 'ctx.step.sleep' in src
            assert 'ctx.step.run' in src


# ============================================================================
# F20: Centrifugo Channel Unification (M4 - R4)
# ============================================================================

@pytest.mark.django_db
class TestF20CentrifugoChannelUnification:

    def test_f20_01_customer_app_subscribes_to_unified_orders_channel(self):
        tracking_tsx = _read_frontend_file('app/src/app/tracking/[id].tsx')
        assert 'orders:order_' in tracking_tsx, "Customer app must subscribe to orders:order_{id}"
        assert 'tracking:order_' not in tracking_tsx, "Legacy tracking:order_{id} channel must be removed"

    def test_f20_02_backend_status_changes_broadcast_to_orders_order_id(
        self, auth_merchant_client, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PENDING)
        mock_centrifugo.clear()
        res = auth_merchant_client.post(f'/api/v1/merchant/orders/{order.id}/status/', {
            'status': Order.Status.CONFIRMED,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        mock_centrifugo.assert_published(channel=f'orders:order_{order.id}')

    def test_f20_03_driver_gps_broadcasts_to_unified_orders_order_id(
        self, driver_user, order_factory, mock_redis_geo, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.ON_THE_WAY)
        DeliveryTrip.objects.create(
            order=order,
            driver=driver_user,
            status=DeliveryTrip.Status.PICKED_UP,
        )
        mock_centrifugo.clear()
        update_driver_gps(driver_user, latitude=24.7190, longitude=46.6790, heading=90.0, speed=30.0)
        mock_centrifugo.assert_published(channel=f'orders:order_{order.id}', event_type='DRIVER_LOCATION')

    def test_f20_04_centrifugo_config_defines_required_namespaces(self):
        cfg = json.loads((BACKEND_ROOT / 'centrifugo_config.json').read_text(encoding='utf-8'))
        namespaces = {ns['name']: ns for ns in cfg.get('namespaces', [])}
        assert 'orders' in namespaces
        assert 'supervisor' in namespaces
        assert namespaces['orders'].get('allow_subscribe_for_client') is True
        assert namespaces['supervisor'].get('allow_subscribe_for_client') is True

    def test_f20_05_centrifugo_token_endpoint_returns_valid_hs256_jwt(
        self, auth_customer_client, customer_user
    ):
        res = auth_customer_client.get('/api/v1/realtime/token/')
        assert res.status_code == status.HTTP_200_OK
        decoded = jwt.decode(res.data['token'], settings.CENTRIFUGO_HMAC_SECRET, algorithms=['HS256'])
        assert decoded['sub'] == str(customer_user.id)


# ============================================================================
# F21: Eliminate Dashboard Polling (M4 - R4)
# ============================================================================

@pytest.mark.django_db
class TestF21EliminateDashboardPolling:

    def test_f21_01_tager_dashboard_eliminates_setinterval_polling(self):
        app_tsx = _read_frontend_file('tager/src/App.tsx')
        assert not re.search(r'setInterval\s*\([\s\S]{0,120}fetchLiveOrders', app_tsx), (
            "tager/src/App.tsx must replace periodic fetchLiveOrders setInterval polling with Centrifugo WebSockets"
        )

    def test_f21_02_supervisor_dashboard_eliminates_setinterval_polling(self):
        app_tsx = _read_frontend_file('supervisor/src/App.tsx')
        assert not re.search(r'setInterval\s*\([\s\S]{0,120}loadFleetData', app_tsx), (
            "supervisor/src/App.tsx must replace periodic loadFleetData setInterval polling with Centrifugo WebSockets"
        )

    def test_f21_03_tager_dashboard_uses_centrifugo_websocket_subscription(self):
        tager_src = _frontend_dir('tager') / 'src'
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in tager_src.rglob('*.ts*'))
        assert 'WebSocket' in combined and ('centrifugo' in combined.lower() or 'connection/websocket' in combined)
        assert 'orders:merchant_' in combined

    def test_f21_04_supervisor_dashboard_subscribes_to_supervisor_operations(self):
        sup_src = _frontend_dir('supervisor') / 'src'
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in sup_src.rglob('*.ts*'))
        assert 'WebSocket' in combined and ('centrifugo' in combined.lower() or 'connection/websocket' in combined)
        assert 'supervisor:operations' in combined

    def test_f21_05_dashboards_cleanup_websocket_on_unmount_and_fetch_initial_snapshot(self):
        tager_app = _read_frontend_file('tager/src/App.tsx')
        sup_app = _read_frontend_file('supervisor/src/App.tsx')
        assert 'fetchLiveOrders()' in tager_app
        assert 'loadFleetData()' in sup_app
        tager_all = '\n'.join(p.read_text(encoding='utf-8') for p in (_frontend_dir('tager') / 'src').rglob('*.ts*'))
        sup_all = '\n'.join(p.read_text(encoding='utf-8') for p in (_frontend_dir('supervisor') / 'src').rglob('*.ts*'))
        assert 'unsubscribe' in tager_all or 'close()' in tager_all
        assert 'unsubscribe' in sup_all or 'close()' in sup_all


# ============================================================================
# F22: Broadcast Supervisor Actions (M4 - R4)
# ============================================================================

@pytest.mark.django_db
class TestF22BroadcastSupervisorActions:

    def test_f22_01_manual_dispatch_broadcasts_to_supervisor_operations(
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
        mock_centrifugo.assert_published(channel='supervisor:operations')

    def test_f22_02_cash_settlement_broadcasts_to_supervisor_operations(
        self, auth_supervisor_client, driver_user, mock_centrifugo
    ):
        profile = driver_user.driver_profile
        profile.cash_in_hand = Decimal('200.00')
        profile.save(update_fields=['cash_in_hand'])
        mock_centrifugo.clear()
        res = auth_supervisor_client.post('/api/v1/supervisor/cash/settle/', {
            'driver_id': str(driver_user.id),
            'amount': 200,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        mock_centrifugo.assert_published(channel='supervisor:operations')

    def test_f22_03_operational_alert_broadcasts_to_supervisor_operations(
        self, order_factory, mock_inngest, mock_centrifugo
    ):
        DriverProfile.objects.all().delete()
        order = order_factory(status=Order.Status.PREPARING)
        mock_centrifugo.clear()
        _invoke_inngest_fn(
            fn_order_auto_dispatch_flow,
            'order/prep.scheduled',
            {'order_id': str(order.id), 'prep_minutes': 5},
        )
        mock_centrifugo.assert_published(channel='supervisor:operations')

    def test_f22_04_supervisor_broadcast_payload_format_valid(
        self, auth_supervisor_client, driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        mock_centrifugo.clear()
        auth_supervisor_client.post('/api/v1/supervisor/dispatch/assign/', {
            'order_id': str(order.id),
            'driver_id': str(driver_user.id),
            'mode': 'direct',
        }, format='json')
        events = mock_centrifugo.filter(channel='supervisor:operations')
        assert len(events) >= 1
        ev = events[0]
        assert ev.event_type
        assert ev.timestamp
        assert str(order.id) in json.dumps(ev.payload) or order.order_number in json.dumps(ev.payload)

    def test_f22_05_non_supervisor_roles_blocked_from_supervisor_actions(
        self, auth_customer_client, auth_merchant_client, auth_driver_client,
        driver_user, order_factory, mock_centrifugo
    ):
        order = order_factory(status=Order.Status.PREPARING)
        mock_centrifugo.clear()
        for client in (auth_customer_client, auth_merchant_client, auth_driver_client):
            r1 = client.post('/api/v1/supervisor/dispatch/assign/', {
                'order_id': str(order.id), 'driver_id': str(driver_user.id), 'mode': 'direct',
            }, format='json')
            assert r1.status_code == status.HTTP_403_FORBIDDEN
            r2 = client.post('/api/v1/supervisor/cash/settle/', {
                'driver_id': str(driver_user.id), 'amount': 50,
            }, format='json')
            assert r2.status_code == status.HTTP_403_FORBIDDEN
        assert not mock_centrifugo.has_event(channel='supervisor:operations')


# ============================================================================
# F23: Driver GPS Redis GEOADD & Write-Behind (M4 - R4)
# ============================================================================

@pytest.mark.django_db
class TestF23DriverGPSRedisGeoaddAndWriteBehind:

    def test_f23_01_gps_update_stores_coords_via_redis_geoadd(
        self, auth_driver_client, driver_user, mock_redis_geo
    ):
        res = auth_driver_client.post('/api/v1/driver/gps/', {
            'latitude': 24.714500,
            'longitude': 46.678900,
            'heading': 120.0,
            'speed': 35.0,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert mock_redis_geo.get_driver_coords(driver_user.id) == (46.6789, 24.7145)

    def test_f23_02_high_frequency_gps_writes_throttle_postgres_updates(
        self, auth_driver_client, driver_user, mock_redis_geo
    ):
        with CaptureQueriesContext(connection) as ctx:
            for i in range(10):
                res = auth_driver_client.post('/api/v1/driver/gps/', {
                    'latitude': round(24.7136 + i * 0.0001, 6),
                    'longitude': round(46.6753 + i * 0.0001, 6),
                }, format='json')
                assert res.status_code == status.HTTP_200_OK

        db_updates = [
            q['sql'] for q in ctx.captured_queries
            if 'UPDATE' in q['sql'].upper() and 'deliveries_driverprofile' in q['sql'].lower()
        ]
        assert len(db_updates) < 10, f"Expected write-behind throttling (<10 DB writes), got {len(db_updates)}"

    def test_f23_03_write_behind_sync_persists_redis_coords_to_postgres(
        self, driver_user, mock_redis_geo
    ):
        from apps.deliveries import services as del_services
        target_lat, target_lon = 24.755500, 46.699900
        mock_redis_geo.client.geoadd('drivers:active', (target_lon, target_lat, str(driver_user.id)))
        mock_redis_geo.client.set(
            f'driver:{driver_user.id}:pos',
            json.dumps({'latitude': target_lat, 'longitude': target_lon, 'heading': 0.0, 'speed': 0.0, 'timestamp': 9999999999.0}),
        )

        flush_fn = (
            getattr(del_services, 'flush_driver_gps_write_behind', None)
            or getattr(del_services, 'sync_driver_gps_to_db', None)
            or getattr(del_services, 'persist_driver_locations_to_db', None)
        )
        assert flush_fn is not None, "Write-behind GPS flush function must exist in apps.deliveries.services"
        flush_fn()
        driver_user.driver_profile.refresh_from_db()
        assert float(driver_user.driver_profile.current_latitude) == pytest.approx(target_lat, abs=1e-4)
        assert float(driver_user.driver_profile.current_longitude) == pytest.approx(target_lon, abs=1e-4)

    def test_f23_04_driver_proximity_lookup_uses_redis_geosearch(
        self, order_factory, driver_user, mock_redis_geo
    ):
        mock_redis_geo.client.geoadd('drivers:active', (46.6753, 24.7136, str(driver_user.id)))
        order = order_factory(status=Order.Status.PREPARING)
        find_candidate_drivers(order, radius_km=5.0, limit=3)
        geo_ops = [c[0] for c in mock_redis_geo.client.calls if c[0] in ('geosearch', 'georadius')]
        assert len(geo_ops) > 0, "find_candidate_drivers should leverage Redis GEOSEARCH/GEORADIUS"

    def test_f23_05_gps_update_stores_timestamp_and_validates_bounds(
        self, auth_driver_client, driver_user, mock_redis_geo
    ):
        res_ok = auth_driver_client.post('/api/v1/driver/gps/', {
            'latitude': 24.7136,
            'longitude': 46.6753,
        }, format='json')
        assert res_ok.status_code == status.HTTP_200_OK
        pos = mock_redis_geo.get_driver_pos_cache(driver_user.id)
        assert pos is not None and isinstance(pos.get('timestamp'), (int, float))

        res_bad = auth_driver_client.post('/api/v1/driver/gps/', {
            'latitude': 95.0,
            'longitude': 200.0,
        }, format='json')
        assert res_bad.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================================
# F24: Store Listing Query Optimization (M5 - R5)
# ============================================================================

@pytest.mark.django_db
class TestF24StoreListingQueryOptimization:

    def test_f24_01_store_listing_avoids_n_plus_1_queries(
        self, api_client, merchant_user, egp_currency
    ):
        zone = RestaurantDeliveryZone.objects.create(
            name='زون الأداء',
            city='الرياض',
            currency=egp_currency,
            polygon_coordinates=_square_polygon(24.7000, 24.7300, 46.6600, 46.6900),
            is_active=True,
        )
        for i in range(12):
            r = Restaurant.objects.create(
                owner=merchant_user,
                name=f'مطعم سريع {i}',
                slug=f'fast-rest-{i}-{uuid.uuid4().hex[:5]}',
                address_text='الرياض',
                latitude=24.7136,
                longitude=46.6753,
                delivery_radius_km=15.0,
                currency=egp_currency,
                is_active=True,
            )
            r.delivery_zones.add(zone)

        with CaptureQueriesContext(connection) as ctx:
            res = api_client.get('/api/v1/customer/restaurants/?lat=24.7136&lng=46.6753')
        assert res.status_code == status.HTTP_200_OK
        assert len(ctx.captured_queries) <= 15, (
            f"N+1 query regression: {len(ctx.captured_queries)} SQL queries executed for 12 stores!"
        )

    def test_f24_02_store_listing_makes_zero_synchronous_osrm_http_calls(
        self, api_client, merchant_user, egp_currency
    ):
        for i in range(5):
            Restaurant.objects.create(
                owner=merchant_user,
                name=f'متجر بلا OSRM {i}',
                slug=f'no-osrm-{i}-{uuid.uuid4().hex[:5]}',
                address_text='الرياض',
                latitude=24.7136 + i * 0.002,
                longitude=46.6753,
                delivery_radius_km=15.0,
                currency=egp_currency,
                is_active=True,
            )

        with patch('requests.get', side_effect=AssertionError("Unexpected synchronous HTTP GET")) as _:
            with patch('requests.post', side_effect=AssertionError("Unexpected synchronous HTTP POST")) as _:
                res = api_client.get('/api/v1/customer/restaurants/?lat=24.7136&lng=46.6753')
        assert res.status_code == status.HTTP_200_OK

    def test_f24_03_store_listing_sorts_by_distance_ascending(
        self, api_client, merchant_user, egp_currency
    ):
        Restaurant.objects.all().delete()
        far = Restaurant.objects.create(
            owner=merchant_user, name='بعيد', slug=f'far-{uuid.uuid4().hex[:5]}',
            address_text='الرياض', latitude=24.7500, longitude=46.6753,
            delivery_radius_km=15.0, currency=egp_currency, is_active=True,
        )
        near = Restaurant.objects.create(
            owner=merchant_user, name='قريب', slug=f'near-{uuid.uuid4().hex[:5]}',
            address_text='الرياض', latitude=24.7140, longitude=46.6753,
            delivery_radius_km=15.0, currency=egp_currency, is_active=True,
        )
        mid = Restaurant.objects.create(
            owner=merchant_user, name='وسط', slug=f'mid-{uuid.uuid4().hex[:5]}',
            address_text='الرياض', latitude=24.7300, longitude=46.6753,
            delivery_radius_km=15.0, currency=egp_currency, is_active=True,
        )

        res = api_client.get('/api/v1/customer/restaurants/?lat=24.7136&lng=46.6753')
        assert res.status_code == status.HTTP_200_OK
        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        ids = [item['id'] for item in data]
        assert ids[:3] == [str(near.id), str(mid.id), str(far.id)]

    def test_f24_04_store_listing_filters_active_and_store_type(
        self, api_client, merchant_user, egp_currency
    ):
        active_sm = Restaurant.objects.create(
            owner=merchant_user, name='سوبرماركت نشط', slug=f'sm-{uuid.uuid4().hex[:5]}',
            store_type=Restaurant.StoreType.SUPERMARKET, address_text='الرياض',
            latitude=24.7136, longitude=46.6753, currency=egp_currency, is_active=True,
        )
        inactive_sm = Restaurant.objects.create(
            owner=merchant_user, name='سوبرماركت مغلق', slug=f'sm-off-{uuid.uuid4().hex[:5]}',
            store_type=Restaurant.StoreType.SUPERMARKET, address_text='الرياض',
            latitude=24.7136, longitude=46.6753, currency=egp_currency, is_active=False,
        )
        res = api_client.get('/api/v1/customer/restaurants/?store_type=SUPERMARKET')
        assert res.status_code == status.HTTP_200_OK
        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        ids = [r['id'] for r in data]
        assert str(active_sm.id) in ids
        assert str(inactive_sm.id) not in ids

    def test_f24_05_store_listing_handles_25_stores_cleanly(
        self, api_client, merchant_user, egp_currency
    ):
        for i in range(25):
            Restaurant.objects.create(
                owner=merchant_user, name=f'متجر {i}', slug=f'pg-{i}-{uuid.uuid4().hex[:5]}',
                address_text='الرياض', latitude=24.7136, longitude=46.6753,
                currency=egp_currency, is_active=True,
            )
        res = api_client.get('/api/v1/customer/restaurants/')
        assert res.status_code == status.HTTP_200_OK
        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        assert len(data) >= 1


# ============================================================================
# F25: Meilisearch Catalog Search & Fallback (M5 - R5)
# ============================================================================

@pytest.mark.django_db
class TestF25MeilisearchCatalogSearch:

    def test_f25_01_search_uses_meilisearch_when_available(
        self, api_client, restaurant, menu_item
    ):
        cache.clear()
        with patch('apps.menus.meilisearch_service.search_meilisearch', return_value={
            'restaurants': [{'id': str(restaurant.id), 'name': restaurant.name}],
            'menu_items': [{'id': str(menu_item.id), 'name': menu_item.name}],
        }) as mock_meili:
            res = api_client.get('/api/v1/customer/search/?q=مارجريتا')
        assert res.status_code == status.HTTP_200_OK
        assert mock_meili.called, "CustomerSearchView should query Meilisearch when available"

    def test_f25_02_search_falls_back_to_db_when_meilisearch_unreachable(
        self, api_client, restaurant, menu_item
    ):
        cache.clear()
        with patch('apps.menus.meilisearch_service.get_meili_client', side_effect=ConnectionError("Meilisearch unreachable")):
            res = api_client.get('/api/v1/customer/search/?q=مارجريتا')
        assert res.status_code == status.HTTP_200_OK
        names = [p['name'] for p in res.data.get('products', [])]
        assert menu_item.name in names

    def test_f25_03_search_supports_arabic_queries(self, api_client, restaurant, menu_item):
        cache.clear()
        res = api_client.get('/api/v1/customer/search/?q=بيتزا')
        assert res.status_code == status.HTTP_200_OK
        store_names = [s['name'] for s in res.data.get('stores', [])]
        assert any('بيتزا' in n for n in store_names)

    def test_f25_04_search_filters_by_store_type_and_geo(
        self, api_client, merchant_user, egp_currency
    ):
        cache.clear()
        near_sm = Restaurant.objects.create(
            owner=merchant_user, name='أسواق قريبة', slug=f'near-sm-{uuid.uuid4().hex[:5]}',
            store_type=Restaurant.StoreType.SUPERMARKET, address_text='الرياض',
            latitude=24.7136, longitude=46.6753, delivery_radius_km=5.0,
            currency=egp_currency, is_active=True,
        )
        far_sm = Restaurant.objects.create(
            owner=merchant_user, name='أسواق بعيدة جداً', slug=f'far-sm-{uuid.uuid4().hex[:5]}',
            store_type=Restaurant.StoreType.SUPERMARKET, address_text='جدة',
            latitude=21.4858, longitude=39.1925, delivery_radius_km=5.0,
            currency=egp_currency, is_active=True,
        )
        res = api_client.get('/api/v1/customer/search/?q=أسواق&store_type=SUPERMARKET&lat=24.7136&lng=46.6753')
        assert res.status_code == status.HTTP_200_OK
        ids = [s['id'] for s in res.data.get('stores', [])]
        assert str(near_sm.id) in ids
        assert str(far_sm.id) not in ids

    def test_f25_05_index_sync_handles_meili_offline_gracefully(self, restaurant, menu_item):
        with patch('apps.menus.meilisearch_service.get_meili_client', side_effect=ConnectionError("Offline")):
            # Neither direct sync nor search should crash when Meilisearch is down
            sync_restaurant_to_meili(restaurant)
            sync_menu_item_to_meili(menu_item)
            res = search_meilisearch('مارجريتا')
            assert res == {'restaurants': [], 'menu_items': []}


# ============================================================================
# F26: Mobile Persistent Storage (M5 - R5)
# ============================================================================

class TestF26MobilePersistentStorage:

    def test_f26_01_mobile_storage_uses_async_storage_not_memory_map(self):
        for rel in ('app/src/services/storage.ts', 'driver/src/services/storage.ts'):
            src = _read_frontend_file(rel)
            assert 'new Map' not in src, f"{rel} must not use volatile in-memory Map storage"
            assert ('AsyncStorage' in src or 'SecureStore' in src), f"{rel} must use AsyncStorage or SecureStore"

    def test_f26_02_mobile_packages_include_persistent_storage_dependency(self):
        for rel in ('app/package.json', 'driver/package.json'):
            pkg = json.loads(_read_frontend_file(rel))
            deps = pkg.get('dependencies', {})
            assert (
                '@react-native-async-storage/async-storage' in deps or 'expo-secure-store' in deps
            ), f"{rel} must declare persistent storage dependency"

    def test_f26_03_auth_stores_persist_and_restore_tokens(self):
        for rel in ('app/src/store/authStore.ts', 'driver/src/store/authStore.ts'):
            src = _read_frontend_file(rel)
            assert 'storage.setItem' in src
            assert 'storage.getItem' in src
            assert 'loadStoredAuth' in src

    def test_f26_04_storage_clears_tokens_on_logout(self):
        for rel in ('app/src/store/authStore.ts', 'driver/src/store/authStore.ts'):
            src = _read_frontend_file(rel)
            assert 'logout:' in src
            assert 'storage.removeItem' in src

    def test_f26_05_storage_adapter_handles_errors_gracefully(self):
        for rel in ('app/src/services/storage.ts', 'driver/src/services/storage.ts'):
            src = _read_frontend_file(rel)
            assert 'try' in src and 'catch' in src


# ============================================================================
# F27: Driver Background Location Tracking (M5 - R5)
# ============================================================================

class TestF27DriverBackgroundLocationTracking:

    def test_f27_01_driver_app_registers_task_manager_background_location(self):
        driver_src = _frontend_dir('driver') / 'src'
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in driver_src.rglob('*.ts*'))
        assert 'defineTask' in combined, "Driver app must define a TaskManager background task"
        assert 'startLocationUpdatesAsync' in combined, "Driver app must call Location.startLocationUpdatesAsync"

    def test_f27_02_driver_package_and_app_json_configure_background_location(self):
        pkg = json.loads(_read_frontend_file('driver/package.json'))
        deps = pkg.get('dependencies', {})
        assert 'expo-task-manager' in deps, "driver/package.json must include expo-task-manager"
        assert 'expo-location' in deps

        app_json = _read_frontend_file('driver/app.json')
        assert ('ACCESS_BACKGROUND_LOCATION' in app_json or 'isIosBackgroundLocationEnabled' in app_json or 'UIBackgroundModes' in app_json), (
            "driver/app.json must configure background location permissions"
        )

    def test_f27_03_background_location_uses_battery_efficient_distance_filter(self):
        driver_src = _frontend_dir('driver') / 'src'
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in driver_src.rglob('*.ts*'))
        assert 'distanceInterval' in combined or 'timeInterval' in combined

    def test_f27_04_background_location_requests_foreground_and_background_permissions(self):
        driver_src = _frontend_dir('driver') / 'src'
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in driver_src.rglob('*.ts*'))
        assert 'requestForegroundPermissionsAsync' in combined
        assert 'requestBackgroundPermissionsAsync' in combined

    def test_f27_05_background_location_stops_updates_on_shift_end(self):
        driver_src = _frontend_dir('driver') / 'src'
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in driver_src.rglob('*.ts*'))
        assert 'stopLocationUpdatesAsync' in combined


# ============================================================================
# F28: Frontend Error Boundaries (M5 - R5)
# ============================================================================

class TestF28FrontendErrorBoundaries:

    def _find_error_boundary_sources(self):
        apps = {
            'app': _frontend_dir('app') / 'src',
            'driver': _frontend_dir('driver') / 'src',
            'tager': _frontend_dir('tager') / 'src',
            'supervisor': _frontend_dir('supervisor') / 'src',
        }
        found = {}
        for name, src_dir in apps.items():
            eb_files = [
                p for p in src_dir.rglob('*.ts*')
                if 'ErrorBoundary' in p.name or 'getDerivedStateFromError' in p.read_text(encoding='utf-8')
            ]
            assert eb_files, f"{name}/src must include an ErrorBoundary component"
            found[name] = eb_files[0].read_text(encoding='utf-8')
        return found

    def test_f28_01_error_boundary_wraps_root_in_all_four_frontends(self):
        self._find_error_boundary_sources()
        roots = [
            'app/src/app/_layout.tsx',
            'driver/src/app/_layout.tsx',
            'tager/src/main.tsx',
            'supervisor/src/main.tsx',
        ]
        for root_rel in roots:
            src = _read_frontend_file(root_rel)
            if 'ErrorBoundary' not in src:
                # Also allow wrapping in App.tsx for Vite apps
                alt_rel = root_rel.replace('main.tsx', 'App.tsx')
                alt_src = _read_frontend_file(alt_rel)
                assert 'ErrorBoundary' in alt_src, f"Root in {root_rel} / {alt_rel} must wrap children with ErrorBoundary"

    def test_f28_02_error_boundary_implements_lifecycle_methods(self):
        eb_map = self._find_error_boundary_sources()
        for name, src in eb_map.items():
            assert 'getDerivedStateFromError' in src, f"{name} ErrorBoundary missing getDerivedStateFromError"
            assert 'componentDidCatch' in src, f"{name} ErrorBoundary missing componentDidCatch"

    def test_f28_03_error_boundary_renders_graceful_fallback_ui(self):
        eb_map = self._find_error_boundary_sources()
        for name, src in eb_map.items():
            assert 'hasError' in src
            assert ('return (' in src or 'return(' in src)

    def test_f28_04_error_boundary_provides_reset_or_retry_action(self):
        eb_map = self._find_error_boundary_sources()
        for name, src in eb_map.items():
            assert ('setState' in src or 'reload' in src), f"{name} ErrorBoundary must provide reset/retry recovery"

    def test_f28_05_error_boundary_logs_error_and_renders_children_when_healthy(self):
        eb_map = self._find_error_boundary_sources()
        for name, src in eb_map.items():
            assert 'console.error' in src or 'onError' in src
            assert 'this.props.children' in src


# ============================================================================
# F29: Driver RTL Layout (M5 - R5)
# ============================================================================

class TestF29DriverRTLLayout:

    def test_f29_01_driver_layout_configures_i18n_manager_force_rtl(self):
        layout_tsx = _read_frontend_file('driver/src/app/_layout.tsx')
        assert 'I18nManager' in layout_tsx
        assert 'I18nManager.allowRTL(true)' in layout_tsx
        assert 'I18nManager.forceRTL(true)' in layout_tsx

    def test_f29_02_driver_screens_use_rtl_alignment(self):
        wallet_tsx = _read_frontend_file('driver/src/app/(tabs)/wallet.tsx')
        assert "row-reverse" in wallet_tsx or "textAlign" in wallet_tsx

    def test_f29_03_driver_source_does_not_force_ltr(self):
        driver_src = _frontend_dir('driver') / 'src'
        for p in driver_src.rglob('*.ts*'):
            content = p.read_text(encoding='utf-8')
            assert 'forceRTL(false)' not in content
            assert 'allowRTL(false)' not in content

    def test_f29_04_driver_app_json_supports_rtl(self):
        app_json = json.loads(_read_frontend_file('driver/app.json'))
        expo_cfg = app_json.get('expo', {})
        extra = expo_cfg.get('extra', {})
        assert extra.get('supportsRTL', True) is not False

    def test_f29_05_driver_layout_persists_or_applies_rtl_before_render(self):
        layout_tsx = _read_frontend_file('driver/src/app/_layout.tsx')
        allow_idx = layout_tsx.find('I18nManager.allowRTL(true)')
        force_idx = layout_tsx.find('I18nManager.forceRTL(true)')
        export_idx = layout_tsx.find('export default function RootLayout')
        assert 0 <= allow_idx < export_idx
        assert 0 <= force_idx < export_idx


# ============================================================================
# F30: Circular Symlink Removal (M5 - R5)
# ============================================================================

class TestF30CircularSymlinkRemoval:

    def test_f30_01_backend_circular_symlink_removed(self):
        sym = BACKEND_ROOT / 'backend'
        assert not sym.exists() and not os.path.islink(sym), (
            f"Circular symlink {sym} must be removed"
        )

    def test_f30_02_no_recursive_symlinks_under_backend(self):
        for root, dirs, files in os.walk(BACKEND_ROOT, followlinks=False):
            for entry in dirs + files:
                full = Path(root) / entry
                if os.path.islink(full):
                    target = os.readlink(full)
                    assert target not in ('/app', '.', '..', str(BACKEND_ROOT)), (
                        f"Recursive symlink detected: {full} -> {target}"
                    )

    def test_f30_03_pytest_collection_clean_without_recursion_errors(self):
        # Verify test directory tree has no symlink loops during discovery
        tests_dir = BACKEND_ROOT / 'tests'
        visited = set()
        for p in tests_dir.rglob('*.py'):
            resolved = p.resolve()
            assert resolved not in visited
            visited.add(resolved)
        assert len(visited) >= 10

    def test_f30_04_backend_app_imports_resolve_cleanly(self):
        import apps.accounts.models
        import apps.orders.models
        import apps.deliveries.models
        import apps.payments.models
        import apps.restaurants.models
        import apps.menus.models
        assert Path(apps.accounts.models.__file__).resolve().is_relative_to(BACKEND_ROOT.resolve())

    def test_f30_05_dockerfile_does_not_create_circular_backend_symlink(self):
        dockerfile = (BACKEND_ROOT / 'Dockerfile').read_text(encoding='utf-8')
        assert 'ln -s' not in dockerfile or '/app/backend' not in dockerfile
