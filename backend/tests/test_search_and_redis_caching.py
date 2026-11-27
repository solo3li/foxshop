"""
FoxShop Instant Search & Redis Caching Test Suite
Covers Requirement R2 (Instant Search with Redis Caching) & R5.

Verifies:
- Search across store names, descriptions, product names, descriptions, and barcodes.
- All 6 sector choices (RESTAURANT, SUPERMARKET, PHARMACY, BUTCHERY_VEG, FLOWERS_GIFTS, GENERAL_RETAIL, ALL).
- Split response format: 'stores' and 'products'.
- Redis cache behavior: cache miss (cached=False, header X-Cache: MISS), cache hit (cached=True, header X-Cache: HIT).
- Cache TTL headers (X-Cache-TTL: 120).
- Cache invalidation on merchant update (version key increment).
- Geofenced search filtering: out-of-zone stores and products omitted when coordinates provided.
- Cache latency acceleration for repeated requests.
"""

import pytest
import time
from decimal import Decimal
from rest_framework import status
from django.core.cache import cache
from apps.accounts.models import User
from apps.restaurants.models import Restaurant, DeliveryZone
from apps.menus.models import MenuCategory, MenuItem
from apps.restaurants.views import invalidate_search_cache


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def multi_sector_setup(db, merchant_user, egp_currency):
    """Sets up stores and products across multiple sectors for search testing."""
    cache.clear()

    # 1. Supermarket with barcode products
    supermarket = Restaurant.objects.create(
        owner=merchant_user,
        name='سوبرماركت التميمي',
        description='جميع المواد الغذائية والمستلزمات اليومية',
        store_type=Restaurant.StoreType.SUPERMARKET,
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=15.0,
        is_active=True
    )
    dairy_cat = MenuCategory.objects.create(restaurant=supermarket, name='الألبان والأجبان')
    milk_item = MenuItem.objects.create(
        category=dairy_cat,
        name='حليب المراعي كامل الدسم 2 لتر',
        description='حليب طازج مبستر غني بالكالسيوم',
        base_price=Decimal('11.50'),
        barcode='6281007001018',
        sku='DAIRY-MILK-02',
        stock_quantity=50,
        is_available=True
    )
    cheese_item = MenuItem.objects.create(
        category=dairy_cat,
        name='جبنة موزاريلا المراعي',
        description='مبشورة للبيتزا والمعجنات',
        base_price=Decimal('22.00'),
        barcode='6281007002025',
        sku='DAIRY-CHZ-01',
        is_available=True
    )

    # 2. Pharmacy
    pharmacy = Restaurant.objects.create(
        owner=merchant_user,
        name='صيدلية الدواء',
        description='أدوية ومستحضرات تجميل ومكملات غذائية',
        store_type=Restaurant.StoreType.PHARMACY,
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=15.0,
        is_active=True
    )
    med_cat = MenuCategory.objects.create(restaurant=pharmacy, name='أدوية عامة')
    panadol_item = MenuItem.objects.create(
        category=med_cat,
        name='بنادول إكسترا أقراص',
        description='مسكن للألم وخافض للحرارة',
        base_price=Decimal('14.00'),
        barcode='6281007003032',
        sku='MED-PAN-01',
        is_available=True
    )

    # 3. Restaurant (Pizza)
    pizza_rest = Restaurant.objects.create(
        owner=merchant_user,
        name='بيتزا الثعلب السريعة',
        description='أشهى بيتزا إيطالية مخبوزة على الحطب',
        store_type=Restaurant.StoreType.RESTAURANT,
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=15.0,
        is_active=True
    )
    pizza_cat = MenuCategory.objects.create(restaurant=pizza_rest, name='بيتزا')
    pepperoni_item = MenuItem.objects.create(
        category=pizza_cat,
        name='بيتزا بيبروني خاصة',
        description='صلصة طماطم وجبنة موزاريلا وبيبروني بقري',
        base_price=Decimal('45.00'),
        barcode='6281007004049',
        is_available=True
    )

    # 4. Butchery & Veg
    butchery = Restaurant.objects.create(
        owner=merchant_user,
        name='ملحمة وخضار الطازج',
        description='لحوم بلدية طازجة وخضروات وفواكه يومية',
        store_type=Restaurant.StoreType.BUTCHERY_VEG,
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=15.0,
        is_active=True
    )

    # 5. Flowers & Gifts
    flowers = Restaurant.objects.create(
        owner=merchant_user,
        name='أزهار الربيع والهدايا',
        description='باقات ورود وتنسيق هدايا لجميع المناسبات',
        store_type=Restaurant.StoreType.FLOWERS_GIFTS,
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=15.0,
        is_active=True
    )

    # 6. General Retail
    retail = Restaurant.objects.create(
        owner=merchant_user,
        name='روائع للتجزئة العامة',
        description='أدوات منزلية وإلكترونيات استهلاكية',
        store_type=Restaurant.StoreType.GENERAL_RETAIL,
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=15.0,
        is_active=True
    )

    return {
        'supermarket': supermarket,
        'pharmacy': pharmacy,
        'pizza_rest': pizza_rest,
        'butchery': butchery,
        'flowers': flowers,
        'retail': retail,
        'milk_item': milk_item,
        'cheese_item': cheese_item,
        'panadol_item': panadol_item,
        'pepperoni_item': pepperoni_item,
    }


# ============================================================================
# Tier 1: Feature Coverage (Core Search & Cache Behavior)
# ============================================================================

@pytest.mark.django_db
class TestSearchAndSplitResponse:
    """Verifies search matching across stores, products, barcodes, and split response schema."""

    def test_search_by_store_name(self, api_client, multi_sector_setup):
        """Search query matching store name returns store in stores array."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=التميمي')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] >= 1
        assert any('التميمي' in s['name'] for s in res.data['stores'])

    def test_search_by_product_name(self, api_client, multi_sector_setup):
        """Search query matching product name returns item in products array."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=حليب')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_products'] >= 1
        product_names = [p['name'] for p in res.data['products']]
        assert any('حليب' in name for name in product_names)

    def test_search_by_product_description(self, api_client, multi_sector_setup):
        """Search query matching product description returns item in products array."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=مسكن')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_products'] >= 1
        assert any('بنادول' in p['name'] for p in res.data['products'])

    def test_search_by_exact_barcode_parameter(self, api_client, multi_sector_setup):
        """Search using ?barcode= parameter returns exact matching product."""
        res = api_client.get('/api/v1/customer/restaurants/search/?barcode=6281007001018')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_products'] == 1
        assert res.data['products'][0]['barcode'] == '6281007001018'
        assert 'حليب' in res.data['products'][0]['name']

    def test_search_by_barcode_in_text_query(self, api_client, multi_sector_setup):
        """Search with barcode number in ?q= query param returns matching product."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=6281007003032')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_products'] >= 1
        assert res.data['products'][0]['barcode'] == '6281007003032'

    def test_split_response_contract_fields(self, api_client, multi_sector_setup):
        """Verifies all required contract fields exist on search response."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=بيتزا')
        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert 'query' in data
        assert 'store_type' in data
        assert 'total_stores' in data
        assert 'total_products' in data
        assert 'cached' in data
        assert 'stores' in data
        assert 'products' in data

        if data['products']:
            product = data['products'][0]
            assert 'id' in product
            assert 'name' in product
            assert 'price' in product
            assert 'base_price' in product
            assert 'restaurant_id' in product
            assert 'restaurant_name' in product
            assert 'store_type' in product

    def test_all_six_sectors_filtering(self, api_client, multi_sector_setup):
        """Verifies filtering across all 6 sectors individually."""
        sectors = [
            'RESTAURANT',
            'SUPERMARKET',
            'PHARMACY',
            'BUTCHERY_VEG',
            'FLOWERS_GIFTS',
            'GENERAL_RETAIL',
        ]
        for sec in sectors:
            res = api_client.get(f'/api/v1/customer/restaurants/search/?store_type={sec}')
            assert res.status_code == status.HTTP_200_OK
            assert res.data['store_type'] == sec
            # All returned stores must belong to this sector
            for store in res.data['stores']:
                assert store['store_type'] == sec
            # All returned products must belong to stores of this sector
            for prod in res.data['products']:
                assert prod['store_type'] == sec


# ============================================================================
# Tier 2: Boundary & Corner Cases (Caching Hit/Miss, TTL, Out of Stock)
# ============================================================================

@pytest.mark.django_db
class TestSearchCacheBehaviorAndBoundaries:
    """Verifies Redis caching hit/miss behavior, TTL headers, and edge cases."""

    def test_cache_miss_then_hit_cycle(self, api_client, multi_sector_setup):
        """First request is a cache miss (cached=False); immediate repeat is a hit (cached=True)."""
        cache.clear()
        url = '/api/v1/customer/restaurants/search/?q=بنادول'

        # 1. First Request: Cache Miss
        res1 = api_client.get(url)
        assert res1.status_code == status.HTTP_200_OK
        assert res1.data['cached'] is False
        assert res1.headers.get('X-Cache') == 'MISS'
        assert res1.headers.get('X-Cache-TTL') == '120'

        # 2. Second Request: Cache Hit
        res2 = api_client.get(url)
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data['cached'] is True
        assert res2.headers.get('X-Cache') == 'HIT'
        assert res2.data['total_products'] == res1.data['total_products']

    def test_empty_query_string_handled(self, api_client, multi_sector_setup):
        """Empty query ?q= returns status 200 without error."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=')
        assert res.status_code == status.HTTP_200_OK
        assert isinstance(res.data['stores'], list)
        assert isinstance(res.data['products'], list)

    def test_nonexistent_term_returns_empty_results(self, api_client, multi_sector_setup):
        """Query with non-matching string returns empty lists."""
        res = api_client.get('/api/v1/customer/restaurants/search/?q=nonexistentword_99999')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] == 0
        assert res.data['total_products'] == 0

    def test_unavailable_product_excluded_from_search(self, api_client, multi_sector_setup):
        """Product marked is_available=False must NOT appear in search results."""
        item = multi_sector_setup['milk_item']
        item.is_available = False
        item.save(update_fields=['is_available'])
        cache.clear()

        res = api_client.get('/api/v1/customer/restaurants/search/?q=حليب')
        assert res.status_code == status.HTTP_200_OK
        product_ids = [p['id'] for p in res.data['products']]
        assert str(item.id) not in product_ids

    def test_inactive_store_excluded_from_search(self, api_client, multi_sector_setup):
        """Store marked is_active=False and its products must NOT appear in search results."""
        store = multi_sector_setup['supermarket']
        store.is_active = False
        store.save(update_fields=['is_active'])
        cache.clear()

        res = api_client.get('/api/v1/customer/restaurants/search/?q=التميمي')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] == 0
        assert res.data['total_products'] == 0


# ============================================================================
# Tier 3: Combinations (Geofencing + Search + Sector)
# ============================================================================

@pytest.mark.django_db
class TestSearchGeofencingCombinations:
    """Verifies geofencing delivery zone enforcement inside the search endpoint."""

    def test_search_omits_out_of_zone_stores_and_products(self, api_client, multi_sector_setup, egp_currency):
        """When coordinates are provided, stores and products outside delivery zones are omitted."""
        cache.clear()
        pizza_store = multi_sector_setup['pizza_rest']

        # Restrict pizza store to North Riyadh zone
        zone = DeliveryZone.objects.create(
            name='نطاق محدد للشمال',
            city='الرياض',
            currency=egp_currency,
            polygon_coordinates=[
                [24.7000, 46.6600],
                [24.7300, 46.6600],
                [24.7300, 46.6900],
                [24.7000, 46.6900],
                [24.7000, 46.6600]
            ],
            is_active=True
        )
        pizza_store.delivery_zones.add(zone)

        # 1. Search with coordinates INSIDE zone -> Pizza store & items appear
        res_inside = api_client.get('/api/v1/customer/restaurants/search/?q=بيتزا&lat=24.7150&lng=46.6750&store_type=RESTAURANT')
        assert res_inside.status_code == status.HTTP_200_OK
        assert res_inside.data['total_stores'] >= 1
        assert res_inside.data['total_products'] >= 1

        # 2. Search with coordinates OUTSIDE zone -> Pizza store & items are omitted
        res_outside = api_client.get('/api/v1/customer/restaurants/search/?q=بيتزا&lat=24.7150&lng=46.7500&store_type=RESTAURANT')
        assert res_outside.status_code == status.HTTP_200_OK
        assert res_outside.data['total_stores'] == 0
        assert res_outside.data['total_products'] == 0

    def test_sector_filter_with_text_query_combination(self, api_client, multi_sector_setup):
        """Searching for 'المراعي' under SUPERMARKET returns milk/cheese, but under RESTAURANT returns nothing."""
        cache.clear()

        # Under Supermarket
        res_super = api_client.get('/api/v1/customer/restaurants/search/?q=المراعي&store_type=SUPERMARKET')
        assert res_super.status_code == status.HTTP_200_OK
        assert res_super.data['total_products'] >= 1

        # Under Restaurant
        res_rest = api_client.get('/api/v1/customer/restaurants/search/?q=المراعي&store_type=RESTAURANT')
        assert res_rest.status_code == status.HTTP_200_OK
        assert res_rest.data['total_products'] == 0


# ============================================================================
# Tier 4: Real-World Workflows (Cache Invalidation & Latency Lifecycle)
# ============================================================================

@pytest.mark.django_db
class TestSearchCacheInvalidationAndLatencyWorkflow:
    """Verifies atomic O(1) version invalidation on merchant update and near-zero latency on cache hits."""

    def test_cache_invalidation_on_merchant_inventory_update(self, api_client, multi_sector_setup):
        """Merchant updates product availability, causing atomic search cache invalidation."""
        cache.clear()
        url = '/api/v1/customer/restaurants/search/?q=حليب'

        # 1. Initial query: MISS
        res1 = api_client.get(url)
        assert res1.status_code == status.HTTP_200_OK
        assert res1.data['cached'] is False

        # 2. Second query: HIT
        res2 = api_client.get(url)
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data['cached'] is True

        # 3. Invalidate search cache (simulating merchant update)
        invalidate_search_cache()

        # 4. Third query after invalidation: MISS (fetches fresh data with new version key)
        res3 = api_client.get(url)
        assert res3.status_code == status.HTTP_200_OK
        assert res3.data['cached'] is False
        assert res3.headers.get('X-Cache') == 'MISS'

        # 5. Fourth query: HIT again on new version
        res4 = api_client.get(url)
        assert res4.status_code == status.HTTP_200_OK
        assert res4.data['cached'] is True
        assert res4.headers.get('X-Cache') == 'HIT'

    def test_cached_query_near_zero_latency(self, api_client, multi_sector_setup):
        """Cached queries return with rapid response times (near-zero latency)."""
        cache.clear()
        url = '/api/v1/customer/restaurants/search/?q=بيتزا'

        # Prime cache
        res_prime = api_client.get(url)
        assert res_prime.status_code == status.HTTP_200_OK

        # Measure 5 consecutive cache hits
        latencies = []
        for _ in range(5):
            t0 = time.perf_counter()
            res = api_client.get(url)
            t1 = time.perf_counter()
            assert res.status_code == status.HTTP_200_OK
            assert res.data['cached'] is True
            assert res.headers.get('X-Cache') == 'HIT'
            latencies.append((t1 - t0) * 1000) # milliseconds

        avg_latency = sum(latencies) / len(latencies)
        # In-memory test cache hits should average well under 50ms per request
        assert avg_latency < 50.0, f"Average cache hit latency was {avg_latency:.2f}ms, expected < 50ms"


@pytest.mark.django_db
class TestSearchPartialMeilisearchAndArabicNormalization:
    """Verifies partial Meilisearch DB fallback, logger safety, category matching, and Arabic normalization."""

    def test_partial_meilisearch_stores_only_still_returns_db_products(self, api_client, multi_sector_setup):
        from unittest.mock import patch
        cache.clear()
        pizza_store = multi_sector_setup['pizza_rest']
        with patch('apps.menus.meilisearch_service.search_meilisearch', return_value={
            'restaurants': [{'id': str(pizza_store.id), 'name': pizza_store.name}],
            'menu_items': [],
        }):
            res = api_client.get('/api/v1/customer/restaurants/search/?q=بيتزا')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] >= 1
        assert res.data['total_products'] >= 1
        assert any('بيتزا' in p['name'] for p in res.data['products'])

    def test_partial_meilisearch_products_only_still_returns_db_stores(self, api_client, multi_sector_setup):
        from unittest.mock import patch
        cache.clear()
        pepperoni = multi_sector_setup['pepperoni_item']
        with patch('apps.menus.meilisearch_service.search_meilisearch', return_value={
            'restaurants': [],
            'menu_items': [{'id': str(pepperoni.id), 'name': pepperoni.name}],
        }):
            res = api_client.get('/api/v1/customer/restaurants/search/?q=بيتزا')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] >= 1
        assert res.data['total_products'] >= 1
        assert any('بيتزا' in s['name'] for s in res.data['stores'])

    def test_arabic_normalization_and_category_name_search(self, api_client, multi_sector_setup):
        cache.clear()
        # Category name is 'أدوية عامة' -> search without hamza and with haa 'ادويه'
        res = api_client.get('/api/v1/customer/restaurants/search/?q=ادويه')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] >= 1
        assert res.data['total_products'] >= 1
        assert any('بنادول' in p['name'] for p in res.data['products'])

    def test_meilisearch_exception_logs_and_falls_back_cleanly(self, api_client, multi_sector_setup):
        from unittest.mock import patch
        cache.clear()
        with patch('apps.menus.meilisearch_service.search_meilisearch', side_effect=RuntimeError('boom')):
            res = api_client.get('/api/v1/customer/restaurants/search/?q=بيتزا')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['total_stores'] >= 1
        assert res.data['total_products'] >= 1
