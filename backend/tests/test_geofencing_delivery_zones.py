"""
FoxShop Strict Delivery Zones Geofencing Test Suite
Covers Requirement R4 (Strict Delivery Zones Geofencing) & R5.

Verifies:
- Point-in-polygon algorithm in DeliveryZone.contains_point(lat, lng) (inside, outside, boundary).
- Store listing filtering: out-of-zone stores omitted when coordinates provided; visible when unlocated.
- Store detail view: is_deliverable flag and Arabic delivery_restriction_message.
- Order checkout validation: strict HTTP 400 rejection with explicit Arabic error message when address is outside delivery zones.
- Fallback behavior for stores without assigned delivery zones.
- End-to-end customer journey across delivery zone boundaries.
"""

import pytest
from decimal import Decimal
from rest_framework import status
from apps.accounts.models import Address, User
from apps.restaurants.models import DeliveryZone, Restaurant
from apps.orders.models import Order
from apps.menus.models import MenuCategory, MenuItem


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def riyadh_polygon_zone(db, egp_currency):
    """Square delivery zone covering Central/North Riyadh: lat 24.70 to 24.73, lng 46.66 to 46.69."""
    coords = [
        [24.7000, 46.6600],
        [24.7300, 46.6600],
        [24.7300, 46.6900],
        [24.7000, 46.6900],
        [24.7000, 46.6600]
    ]
    return DeliveryZone.objects.create(
        name='نطاق وسط وشمال الرياض',
        city='الرياض',
        currency=egp_currency,
        base_delivery_fee=Decimal('15.00'),
        base_distance_km=Decimal('3.00'),
        per_km_fee=Decimal('1.50'),
        max_delivery_fee=Decimal('35.00'),
        polygon_coordinates=coords,
        is_active=True
    )


@pytest.fixture
def southern_polygon_zone(db, egp_currency):
    """Separate non-overlapping zone in South Riyadh: lat 24.55 to 24.60, lng 46.66 to 46.69."""
    coords = [
        [24.5500, 46.6600],
        [24.6000, 46.6600],
        [24.6000, 46.6900],
        [24.5500, 46.6900],
        [24.5500, 46.6600]
    ]
    return DeliveryZone.objects.create(
        name='نطاق جنوب الرياض',
        city='الرياض',
        currency=egp_currency,
        base_delivery_fee=Decimal('18.00'),
        polygon_coordinates=coords,
        is_active=True
    )


# ============================================================================
# Tier 1: Feature Coverage (Unit & Integration Happy Paths)
# ============================================================================

@pytest.mark.django_db
class TestGeofencingContainsPoint:
    """Direct unit tests for DeliveryZone.contains_point(lat, lng)."""

    def test_contains_point_strictly_inside(self, riyadh_polygon_zone):
        """Center point of zone must return True."""
        assert riyadh_polygon_zone.contains_point(24.7150, 46.6750) is True

    def test_contains_point_outside_east(self, riyadh_polygon_zone):
        """Point east of polygon by ~7km must return False."""
        assert riyadh_polygon_zone.contains_point(24.7150, 46.7500) is False

    def test_contains_point_outside_north(self, riyadh_polygon_zone):
        """Point north of polygon by ~8km must return False."""
        assert riyadh_polygon_zone.contains_point(24.8000, 46.6750) is False

    def test_contains_point_outside_south(self, riyadh_polygon_zone):
        """Point south of polygon must return False."""
        assert riyadh_polygon_zone.contains_point(24.6000, 46.6750) is False


@pytest.mark.django_db
class TestRestaurantListingGeofencing:
    """Verifies store visibility filtering in CustomerRestaurantListView."""

    def test_store_included_when_coordinates_inside_zone(self, api_client, restaurant, riyadh_polygon_zone):
        """Customer inside zone sees the store in the listing."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        response = api_client.get('/api/v1/customer/restaurants/?lat=24.7150&lng=46.6750')
        assert response.status_code == status.HTTP_200_OK
        ids = [item['id'] for item in response.data]
        assert str(restaurant.id) in ids

    def test_store_omitted_when_coordinates_outside_zone(self, api_client, restaurant, riyadh_polygon_zone):
        """Customer outside zone must NOT see the store in the listing."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        # Coordinate is outside delivery zone (east)
        response = api_client.get('/api/v1/customer/restaurants/?lat=24.7150&lng=46.7500')
        assert response.status_code == status.HTTP_200_OK
        ids = [item['id'] for item in response.data]
        assert str(restaurant.id) not in ids

    def test_unlocated_browsing_displays_all_active_stores(self, api_client, restaurant, riyadh_polygon_zone):
        """Customer browsing without coordinates sees all active stores."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        response = api_client.get('/api/v1/customer/restaurants/')
        assert response.status_code == status.HTTP_200_OK
        ids = [item['id'] for item in response.data]
        assert str(restaurant.id) in ids


@pytest.mark.django_db
class TestStoreDetailDeliveryRestrictions:
    """Verifies is_deliverable flag and delivery_restriction_message in detail view."""

    def test_store_detail_inside_zone_is_deliverable(self, api_client, restaurant, riyadh_polygon_zone):
        """When viewing store with coordinates inside zone, is_deliverable is True."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        url = f'/api/v1/customer/restaurants/{restaurant.id}/?lat=24.7150&lng=46.6750'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_deliverable'] is True
        assert response.data.get('delivery_restriction_message') is None

    def test_store_detail_outside_zone_is_not_deliverable(self, api_client, restaurant, riyadh_polygon_zone):
        """When viewing store with coordinates outside zone, is_deliverable is False with Arabic message."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        url = f'/api/v1/customer/restaurants/{restaurant.id}/?lat=24.7150&lng=46.7500'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_deliverable'] is False
        restriction_msg = response.data.get('delivery_restriction_message') or ''
        assert 'خارج مناطق التوصيل المعتمدة' in restriction_msg

    def test_store_detail_unlocated_is_deliverable(self, api_client, restaurant, riyadh_polygon_zone):
        """When browsing store without coordinates, is_deliverable is True (browsing permitted)."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        url = f'/api/v1/customer/restaurants/{restaurant.id}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_deliverable'] is True
        assert response.data.get('delivery_restriction_message') is None


@pytest.mark.django_db
class TestOrderCheckoutGeofencing:
    """Verifies strict rejection of out-of-zone orders during checkout."""

    def test_checkout_rejected_when_address_outside_zone(self, api_client, customer_user, restaurant, menu_item, riyadh_polygon_zone):
        """Order placement must be rejected with 400 when address is outside active delivery zones."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)
        api_client.force_authenticate(user=customer_user)

        out_address = Address.objects.create(
            user=customer_user,
            title='موقع خارج النطاق',
            street='طريق الدمام',
            latitude=24.7150,
            longitude=46.7500 # Outside zone polygon!
        )

        payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(out_address.id),
            'payment_method': 'COD',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
        }

        response = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        error_text = str(response.data)
        assert "خارج مناطق التوصيل المعتمدة" in error_text
        assert restaurant.name in error_text

    def test_checkout_accepted_when_address_inside_zone(self, api_client, customer_user, restaurant, menu_item, riyadh_polygon_zone):
        """Order placement must succeed (201 Created) when address is inside active delivery zones."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)
        api_client.force_authenticate(user=customer_user)

        in_address = Address.objects.create(
            user=customer_user,
            title='موقع داخل النطاق',
            street='شارع العليا',
            latitude=24.7150,
            longitude=46.6750 # Inside zone polygon!
        )

        payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(in_address.id),
            'payment_method': 'COD',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
        }

        response = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['order_number'].startswith('FOX-')


# ============================================================================
# Tier 2: Boundary & Corner Cases
# ============================================================================

@pytest.mark.django_db
class TestGeofencingBoundariesAndCornerCases:
    """Boundary conditions, empty coords, inactive zones, and radius fallbacks."""

    def test_empty_polygon_coordinates_returns_false(self, egp_currency):
        """DeliveryZone with empty polygon coordinates must return False."""
        zone = DeliveryZone.objects.create(
            name='منطقة فارغة',
            city='الرياض',
            currency=egp_currency,
            polygon_coordinates=[]
        )
        assert zone.contains_point(24.7150, 46.6750) is False

    def test_inactive_delivery_zone_ignored_in_range_check(self, restaurant, riyadh_polygon_zone):
        """Inactive delivery zones must not be considered for coverage."""
        riyadh_polygon_zone.is_active = False
        riyadh_polygon_zone.save(update_fields=['is_active'])
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        # Since only active zone is inactive, restaurant falls back to radial check
        # Point inside restaurant radius (coords ~ 1km away, delivery_radius_km=15)
        in_range, dist = restaurant.is_within_delivery_range(24.7150, 46.6750)
        assert in_range is True
        assert dist <= restaurant.delivery_radius_km

    def test_store_without_delivery_zones_falls_back_to_radius(self, api_client, restaurant):
        """Store with no delivery zones defined uses delivery_radius_km check."""
        restaurant.delivery_zones.clear()
        assert restaurant.has_active_delivery_zones is False

        # 1. Point close to restaurant (within 15km)
        in_range, dist = restaurant.is_within_delivery_range(24.7150, 46.6760)
        assert in_range is True

        # 2. Point far away (>50km away)
        out_range, far_dist = restaurant.is_within_delivery_range(25.5000, 47.5000)
        assert out_range is False
        assert far_dist > restaurant.delivery_radius_km

    def test_invalid_query_coordinates_gracefully_fallback(self, api_client, restaurant, riyadh_polygon_zone):
        """Non-numeric coordinates in query params should gracefully fall back without 500 error."""
        restaurant.delivery_zones.add(riyadh_polygon_zone)

        res = api_client.get('/api/v1/customer/restaurants/?lat=invalid_lat&lng=invalid_lng')
        assert res.status_code == status.HTTP_200_OK

        res_detail = api_client.get(f'/api/v1/customer/restaurants/{restaurant.id}/?lat=abc&lng=xyz')
        assert res_detail.status_code == status.HTTP_200_OK
        assert res_detail.data['is_deliverable'] is True


# ============================================================================
# Tier 3: Cross-Zone Combinations & Multiple Zones
# ============================================================================

@pytest.mark.django_db
class TestMultipleZonesAndStoreFiltering:
    """Tests restaurants covering multiple distinct zones and multi-store listing filtering."""

    def test_store_with_multiple_zones_covers_either(self, restaurant, riyadh_polygon_zone, southern_polygon_zone):
        """Store assigned to North Zone and South Zone covers points in either zone."""
        restaurant.delivery_zones.add(riyadh_polygon_zone, southern_polygon_zone)

        # In North Zone
        in_north, _ = restaurant.is_within_delivery_range(24.7150, 46.6750)
        assert in_north is True

        # In South Zone
        in_south, _ = restaurant.is_within_delivery_range(24.5750, 46.6750)
        assert in_south is True

        # In middle gap between zones (lat 24.65)
        in_gap, _ = restaurant.is_within_delivery_range(24.6500, 46.6750)
        assert in_gap is False

    def test_multi_store_listing_filters_correct_stores(self, api_client, merchant_user, egp_currency, riyadh_polygon_zone, southern_polygon_zone):
        """In a listing with multiple stores in different zones, only covered stores appear."""
        # Store A: North Zone
        store_a = Restaurant.objects.create(
            owner=merchant_user,
            name='مطعم الشمال',
            currency=egp_currency,
            latitude=24.7136,
            longitude=46.6753,
            is_active=True
        )
        store_a.delivery_zones.add(riyadh_polygon_zone)

        # Store B: South Zone
        store_b = Restaurant.objects.create(
            owner=merchant_user,
            name='مطعم الجنوب',
            currency=egp_currency,
            latitude=24.5800,
            longitude=46.6753,
            is_active=True
        )
        store_b.delivery_zones.add(southern_polygon_zone)

        # Query in North Zone: Store A appears, Store B is omitted
        res_north = api_client.get('/api/v1/customer/restaurants/?lat=24.7150&lng=46.6750')
        assert res_north.status_code == status.HTTP_200_OK
        north_ids = [item['id'] for item in res_north.data]
        assert str(store_a.id) in north_ids
        assert str(store_b.id) not in north_ids

        # Query in South Zone: Store B appears, Store A is omitted
        res_south = api_client.get('/api/v1/customer/restaurants/?lat=24.5750&lng=46.6750')
        assert res_south.status_code == status.HTTP_200_OK
        south_ids = [item['id'] for item in res_south.data]
        assert str(store_b.id) in south_ids
        assert str(store_a.id) not in south_ids


# ============================================================================
# Tier 4: Real-World Workflow (Customer Delivery Zone Flow)
# ============================================================================

@pytest.mark.django_db
class TestCustomerGeofencingWorkflow:
    """Tests the full end-to-end customer workflow from browsing unlocated to checkout rejection and success."""

    def test_customer_journey_browsing_to_checkout_with_geofence(
        self, api_client, customer_user, restaurant, menu_item, riyadh_polygon_zone
    ):
        restaurant.delivery_zones.add(riyadh_polygon_zone)
        api_client.force_authenticate(user=customer_user)

        # Step 1: Customer browses restaurants unlocated -> Store is visible
        browse_res = api_client.get('/api/v1/customer/restaurants/')
        assert browse_res.status_code == status.HTTP_200_OK
        assert any(s['id'] == str(restaurant.id) for s in browse_res.data)

        # Step 2: Customer opens store page without location -> allowed to browse
        store_page = api_client.get(f'/api/v1/customer/restaurants/{restaurant.id}/')
        assert store_page.status_code == status.HTTP_200_OK
        assert store_page.data['is_deliverable'] is True

        # Step 3: Customer sets out-of-zone location -> is_deliverable turns False with warning
        store_page_outside = api_client.get(f'/api/v1/customer/restaurants/{restaurant.id}/?lat=24.7150&lng=46.7500')
        assert store_page_outside.status_code == status.HTTP_200_OK
        assert store_page_outside.data['is_deliverable'] is False
        assert "خارج مناطق التوصيل المعتمدة" in store_page_outside.data['delivery_restriction_message']

        # Step 4: Customer creates out-of-zone address and attempts checkout -> Rejected (400)
        out_addr = Address.objects.create(
            user=customer_user,
            title='استراحة الثمامة',
            street='طريق الثمامة',
            latitude=24.7150,
            longitude=46.7500
        )
        bad_checkout_payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(out_addr.id),
            'payment_method': 'COD',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
        }
        rejected_res = api_client.post('/api/v1/customer/orders/checkout/', bad_checkout_payload, format='json')
        assert rejected_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "خارج مناطق التوصيل المعتمدة" in str(rejected_res.data)

        # Step 5: Customer switches to home address inside the zone -> Checkout succeeds (201)
        in_addr = Address.objects.create(
            user=customer_user,
            title='شقة العليا',
            street='شارع العليا العام',
            latitude=24.7150,
            longitude=46.6750
        )
        good_checkout_payload = {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(in_addr.id),
            'payment_method': 'COD',
            'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
        }
        success_res = api_client.post('/api/v1/customer/orders/checkout/', good_checkout_payload, format='json')
        assert success_res.status_code == status.HTTP_201_CREATED
        assert success_res.data['order_number'].startswith('FOX-')
