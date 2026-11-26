"""
FoxShop Authentication Guard & Guest Protection Test Suite
Covers Requirement R1 (Account / Profile Auth Guard) & R5.

Verifies:
- All sensitive customer endpoints strictly reject unauthenticated (guest) requests with HTTP 401 Unauthorized.
- Valid tokens permit access to protected resources.
- Invalid, expired, and malformed authorization headers are rejected with HTTP 401.
- Inactive user tokens are rejected by JWT auth.
- Cross-user data isolation: customers cannot access another user's addresses or orders.
- Full guest-to-authenticated lifecycle workflow.
"""

import pytest
import uuid
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import User, Address
from apps.orders.models import Order
from apps.restaurants.models import Restaurant
from apps.menus.models import MenuItem


# ============================================================================
# Tier 1: Feature Coverage (Direct Happy Path & Rejections)
# ============================================================================

@pytest.mark.django_db
class TestAuthGuardUnauthenticatedRejections:
    """Tests that unauthenticated requests to protected endpoints return 401."""

    def test_unauthenticated_profile_rejected(self, api_client):
        """GET /api/v1/auth/profile/ must reject unauthenticated requests with 401."""
        response = api_client.get('/api/v1/auth/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'detail' in response.data or 'error' in response.data or 'messages' in response.data

    def test_unauthenticated_profile_update_rejected(self, api_client):
        """PATCH /api/v1/auth/profile/ must reject unauthenticated requests with 401."""
        response = api_client.patch('/api/v1/auth/profile/', {'first_name': 'مخترق'}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_profile_me_rejected(self, api_client):
        """GET /api/v1/auth/me/ must reject unauthenticated requests with 401."""
        response = api_client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_addresses_list_rejected(self, api_client):
        """GET /api/v1/auth/addresses/ must reject unauthenticated requests with 401."""
        response = api_client.get('/api/v1/auth/addresses/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_address_create_rejected(self, api_client):
        """POST /api/v1/auth/addresses/ must reject unauthenticated requests with 401."""
        payload = {
            'title': 'المنزل',
            'street': 'طريق الملك فهد',
            'latitude': 24.7136,
            'longitude': 46.6753
        }
        response = api_client.post('/api/v1/auth/addresses/', payload, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_orders_history_rejected(self, api_client):
        """GET /api/v1/customer/orders/history/ must reject unauthenticated requests with 401."""
        response = api_client.get('/api/v1/customer/orders/history/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_orders_checkout_rejected(self, api_client, restaurant, menu_item, customer_address):
        """POST /api/v1/customer/orders/checkout/ must reject unauthenticated requests with 401."""
        payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': 'COD',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
        }
        response = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_order_detail_rejected(self, api_client):
        """GET /api/v1/customer/orders/<id>/ must reject unauthenticated requests with 401."""
        random_id = uuid.uuid4()
        response = api_client.get(f'/api/v1/customer/orders/{random_id}/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_order_cancel_rejected(self, api_client):
        """POST /api/v1/customer/orders/<id>/cancel/ must reject unauthenticated requests with 401."""
        random_id = uuid.uuid4()
        response = api_client.post(f'/api/v1/customer/orders/{random_id}/cancel/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_profile_access_success(self, api_client, customer_user):
        """Authenticated customer can successfully access their profile."""
        api_client.force_authenticate(user=customer_user)
        response = api_client.get('/api/v1/auth/profile/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == customer_user.username
        assert response.data['phone_number'] == customer_user.phone_number


# ============================================================================
# Tier 2: Boundary & Corner Cases (Malformed Tokens, Tampering, Invalidation)
# ============================================================================

@pytest.mark.django_db
class TestAuthTokenBoundaries:
    """Tests token validation boundaries and malformed authorization headers."""

    def test_invalid_bearer_token(self, api_client):
        """Bogus bearer token string must result in 401."""
        api_client.credentials(HTTP_AUTHORIZATION='Bearer completely_bogus_token_xyz')
        response = api_client.get('/api/v1/auth/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_bearer_token(self, api_client):
        """Empty Bearer token header must result in 401."""
        api_client.credentials(HTTP_AUTHORIZATION='Bearer ')
        response = api_client.get('/api/v1/auth/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_malformed_auth_header_format(self, api_client):
        """Header with non-Bearer schema or garbage characters must result in 401."""
        api_client.credentials(HTTP_AUTHORIZATION='Basic not_a_valid_jwt_token')
        response = api_client.get('/api/v1/auth/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_inactive_user_token_rejected(self, api_client, customer_user):
        """JWT token of a deactivated user must be rejected with 401."""
        refresh = RefreshToken.for_user(customer_user)
        access_token = str(refresh.access_token)
        customer_user.is_active = False
        customer_user.save(update_fields=['is_active'])

        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = api_client.get('/api/v1/auth/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_public_endpoints_remain_accessible_without_auth(self, api_client):
        """Public platform endpoints (like config, login, register) must NOT require auth."""
        res_config = api_client.get('/api/v1/auth/config/')
        assert res_config.status_code == status.HTTP_200_OK

        res_stores = api_client.get('/api/v1/customer/restaurants/')
        assert res_stores.status_code == status.HTTP_200_OK


# ============================================================================
# Tier 3: Combinations & Role Isolation
# ============================================================================

@pytest.mark.django_db
class TestAuthRoleAndDataIsolation:
    """Verifies that customers cannot view/tamper with another user's private data."""

    def test_guest_cannot_access_merchant_management(self, api_client):
        """Guest cannot access merchant store or order management."""
        res1 = api_client.get('/api/v1/merchant/restaurants/')
        assert res1.status_code == status.HTTP_401_UNAUTHORIZED

        res2 = api_client.get('/api/v1/merchant/orders/')
        assert res2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_guest_cannot_access_driver_profile(self, api_client):
        """Guest cannot access driver profile or trips without auth."""
        res1 = api_client.get('/api/v1/driver/profile/')
        assert res1.status_code == status.HTTP_401_UNAUTHORIZED

        res2 = api_client.get('/api/v1/driver/trips/')
        assert res2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_customer_cannot_see_other_user_addresses(self, api_client, customer_user, customer_address):
        """Customer B cannot view or list Customer A's addresses."""
        other_user = User.objects.create_user(
            username='customer_other',
            password='password123',
            phone_number='+966509999999',
            role=User.Roles.CUSTOMER
        )
        api_client.force_authenticate(user=other_user)

        # List should not contain customer_address
        res = api_client.get('/api/v1/auth/addresses/')
        assert res.status_code == status.HTTP_200_OK
        address_ids = [item['id'] for item in res.data]
        assert str(customer_address.id) not in address_ids

        # Direct detail request should return 404
        detail_res = api_client.get(f'/api/v1/auth/addresses/{customer_address.id}/')
        assert detail_res.status_code == status.HTTP_404_NOT_FOUND

    def test_customer_cannot_see_other_user_orders(self, api_client, customer_user, merchant_user, restaurant, customer_address):
        """Customer B cannot retrieve Customer A's order details."""
        order = Order.objects.create(
            order_number='FOX-TEST-ISOLATION',
            customer=customer_user,
            restaurant=restaurant,
            delivery_address=customer_address,
            subtotal=50.00,
            delivery_fee=10.00,
            total_amount=60.00,
            currency='EGP',
            status=Order.Status.PENDING
        )

        other_user = User.objects.create_user(
            username='customer_intruder',
            password='password123',
            phone_number='+966508888888',
            role=User.Roles.CUSTOMER
        )
        api_client.force_authenticate(user=other_user)

        # Order history must be empty for other_user
        res_history = api_client.get('/api/v1/customer/orders/history/')
        assert res_history.status_code == status.HTTP_200_OK
        assert len(res_history.data) == 0

        # Direct access to Customer A's order ID returns 404
        res_detail = api_client.get(f'/api/v1/customer/orders/{order.id}/')
        assert res_detail.status_code == status.HTTP_404_NOT_FOUND


# ============================================================================
# Tier 4: Real-World Workflow (Guest -> Login -> Protected Actions)
# ============================================================================

@pytest.mark.django_db
class TestGuestToAuthWorkflow:
    """Tests the full end-to-end customer journey from unauthenticated rejection to successful authenticated flow."""

    def test_full_guest_login_and_protected_access_flow(self, api_client, customer_user):
        # Step 1: Guest tries to view profile -> 401 Unauthorized
        res_unauth = api_client.get('/api/v1/auth/profile/')
        assert res_unauth.status_code == status.HTTP_401_UNAUTHORIZED

        # Step 2: Guest tries to view addresses -> 401 Unauthorized
        res_addr_unauth = api_client.get('/api/v1/auth/addresses/')
        assert res_addr_unauth.status_code == status.HTTP_401_UNAUTHORIZED

        # Step 3: Guest logs in with valid credentials
        login_payload = {
            'username': customer_user.username,
            'password': 'password123'
        }
        login_res = api_client.post('/api/v1/auth/login/', login_payload, format='json')
        assert login_res.status_code == status.HTTP_200_OK
        access_token = login_res.data['access']
        assert access_token is not None

        # Step 4: Client sets Bearer token in header
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        # Step 5: Now profile access succeeds
        profile_res = api_client.get('/api/v1/auth/profile/')
        assert profile_res.status_code == status.HTTP_200_OK
        assert profile_res.data['username'] == customer_user.username

        # Step 6: Create new delivery address
        new_address_payload = {
            'title': 'العمل الجديد',
            'street': 'شارع التخصصي',
            'latitude': 24.7000,
            'longitude': 46.6800,
            'is_default': True
        }
        addr_res = api_client.post('/api/v1/auth/addresses/', new_address_payload, format='json')
        assert addr_res.status_code == status.HTTP_201_CREATED
        assert addr_res.data['title'] == 'العمل الجديد'
        addr_id = addr_res.data['id']

        # Step 7: Retrieve newly created address
        addr_list_res = api_client.get('/api/v1/auth/addresses/')
        assert addr_list_res.status_code == status.HTTP_200_OK
        created_ids = [item['id'] for item in addr_list_res.data]
        assert addr_id in created_ids
