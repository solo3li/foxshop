import os
import logging

logger = logging.getLogger(__name__)

MEILISEARCH_URL = os.getenv("MEILISEARCH_URL", "http://meilisearch:7700")
MEILISEARCH_KEY = os.getenv("MEILISEARCH_KEY", "foxshop_meili_master_key_2026")

_client = None

def get_meili_client():
    global _client
    if _client is not None:
        return _client
    try:
        import meilisearch
        _client = meilisearch.Client(MEILISEARCH_URL, MEILISEARCH_KEY)
        return _client
    except Exception as e:
        logger.warning(f"Meilisearch client initialization warning: {e}")
        return None


def init_meilisearch_indexes():
    client = get_meili_client()
    if not client:
        return
    try:
        # 1. Restaurants Index
        rest_idx = client.index('restaurants')
        rest_idx.update_searchable_attributes(['name', 'description', 'address_text'])
        rest_idx.update_filterable_attributes(['is_active', 'is_busy', 'rating', '_geo'])
        rest_idx.update_sortable_attributes(['rating', 'delivery_fee'])

        # 2. Menu Items Index
        items_idx = client.index('menu_items')
        items_idx.update_searchable_attributes(['name', 'description', 'category_name', 'restaurant_name'])
        items_idx.update_filterable_attributes(['is_available', 'restaurant_id', 'base_price', '_geo'])
        items_idx.update_sortable_attributes(['base_price'])
    except Exception as e:
        logger.warning(f"Could not initialize Meilisearch indexes: {e}")


def sync_restaurant_to_meili(restaurant):
    client = get_meili_client()
    if not client:
        return
    try:
        doc = {
            'id': str(restaurant.id),
            'name': restaurant.name,
            'description': restaurant.description or '',
            'address_text': restaurant.address_text or '',
            'rating': float(restaurant.rating or 5.0),
            'delivery_fee': float(restaurant.delivery_fee or 0.0),
            'is_active': bool(restaurant.is_active),
            'is_busy': bool(restaurant.is_busy),
            '_geo': {
                'lat': float(restaurant.latitude),
                'lng': float(restaurant.longitude),
            } if restaurant.latitude and restaurant.longitude else None,
        }
        client.index('restaurants').add_documents([doc], primary_key='id')
    except Exception as e:
        logger.warning(f"Failed to sync restaurant {restaurant.id} to Meilisearch: {e}")


def delete_restaurant_from_meili(restaurant_id):
    client = get_meili_client()
    if not client:
        return
    try:
        client.index('restaurants').delete_document(str(restaurant_id))
    except Exception as e:
        logger.warning(f"Failed to delete restaurant {restaurant_id} from Meilisearch: {e}")


def sync_menu_item_to_meili(item):
    client = get_meili_client()
    if not client:
        return
    try:
        rest = item.category.restaurant
        doc = {
            'id': str(item.id),
            'name': item.name,
            'description': item.description or '',
            'base_price': float(item.base_price),
            'is_available': bool(item.is_available),
            'is_popular': bool(item.is_popular),
            'category_id': str(item.category.id),
            'category_name': item.category.name,
            'restaurant_id': str(rest.id),
            'restaurant_name': rest.name,
            '_geo': {
                'lat': float(rest.latitude),
                'lng': float(rest.longitude),
            } if rest.latitude and rest.longitude else None,
        }
        client.index('menu_items').add_documents([doc], primary_key='id')
    except Exception as e:
        logger.warning(f"Failed to sync menu item {item.id} to Meilisearch: {e}")


def delete_menu_item_from_meili(item_id):
    client = get_meili_client()
    if not client:
        return
    try:
        client.index('menu_items').delete_document(str(item_id))
    except Exception as e:
        logger.warning(f"Failed to delete menu item {item_id} from Meilisearch: {e}")


def search_meilisearch(query, lat=None, lng=None, radius_meters=10000, limit=20):
    client = get_meili_client()
    if not client:
        return {"restaurants": [], "menu_items": []}

    search_params = {
        'limit': limit,
    }
    if lat is not None and lng is not None:
        search_params['filter'] = f"_geoRadius({lat}, {lng}, {radius_meters})"

    try:
        rest_res = client.index('restaurants').search(query, search_params)
        item_res = client.index('menu_items').search(query, search_params)
        return {
            "restaurants": rest_res.get('hits', []),
            "menu_items": item_res.get('hits', []),
        }
    except Exception as e:
        logger.warning(f"Meilisearch search error: {e}")
        return {"restaurants": [], "menu_items": []}
