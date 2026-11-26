"""
OSRM Routing Service for FoxShop Deliveries.
Provides driving distance and route calculation between coordinates.
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def get_driving_route(origin_lat, origin_lng, dest_lat, dest_lng):
    """
    Query OSRM server to get driving route distance and duration.
    Should only be used asynchronously or for active trips, NOT in store listings.
    """
    osrm_url = getattr(settings, 'OSRM_BACKEND_URL', 'http://osrm:5000')
    endpoint = f"{osrm_url}/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=false"
    try:
        resp = requests.get(endpoint, timeout=3.0)
        if resp.status_code == 200:
            data = resp.json()
            routes = data.get('routes', [])
            if routes:
                distance_km = round(routes[0]['distance'] / 1000.0, 2)
                duration_mins = round(routes[0]['duration'] / 60.0, 1)
                return {
                    'distance_km': distance_km,
                    'duration_mins': duration_mins,
                    'success': True
                }
    except Exception as e:
        logger.warning(f"OSRM route request failed: {e}")
    return None
