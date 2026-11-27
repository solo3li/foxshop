"""
OSRM Routing Service for FoxShop Deliveries.
Provides driving distance, duration, and encoded polyline route calculation on OSM road networks.
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

PUBLIC_OSRM_URL = 'https://router.project-osrm.org'


def get_driving_route(origin_lat, origin_lng, dest_lat, dest_lng, overview=False):
    """
    Query OSRM server to get driving route distance, duration, and optional encoded polyline.
    Tries configured OSRM_BACKEND_URL first, then falls back to public OSRM router.
    """
    configured_url = getattr(settings, 'OSRM_BACKEND_URL', '').rstrip('/')
    base_urls = [u for u in [configured_url, PUBLIC_OSRM_URL] if u]
    # Deduplicate while preserving order
    seen = set()
    candidates = [u for u in base_urls if not (u in seen or seen.add(u))]

    params = "overview=full&geometries=polyline&steps=true" if overview else "overview=false"

    for base_url in candidates:
        endpoint = f"{base_url}/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?{params}"
        timeout = 2.0 if 'osrm:' in base_url or 'localhost' in base_url else 5.0
        try:
            resp = requests.get(endpoint, timeout=timeout)
            if resp.status_code == 200:
                data = resp.json()
                routes = data.get('routes', [])
                if routes:
                    route = routes[0]
                    distance_km = round(route['distance'] / 1000.0, 2)
                    duration_mins = max(1, round(route['duration'] / 60.0))
                    result = {
                        'distance_km': distance_km,
                        'duration_mins': duration_mins,
                        'duration_minutes': duration_mins,
                        'polyline': route.get('geometry', '') if overview else '',
                        'steps': [],
                        'success': True,
                    }
                    if overview and route.get('legs'):
                        for step in route['legs'][0].get('steps', []):
                            maneuver = step.get('maneuver', {})
                            loc = maneuver.get('location', [0, 0])
                            result['steps'].append({
                                'instruction': step.get('name') or maneuver.get('type', ''),
                                'distance_meters': round(step.get('distance', 0)),
                                'distance_text': f"{round(step.get('distance', 0))} م",
                                'duration_text': f"{max(1, round(step.get('duration', 0) / 60))} د",
                                'maneuver': maneuver.get('modifier') or maneuver.get('type', 'straight'),
                                'start_location': {'lat': loc[1], 'lng': loc[0]} if len(loc) >= 2 else {},
                                'end_location': {},
                            })
                    return result
        except Exception as e:
            logger.warning(f"OSRM route request failed ({base_url}): {e}")
    return None
