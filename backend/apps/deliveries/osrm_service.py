import os
import logging
import requests
from decimal import Decimal
from apps.restaurants.models import haversine_distance_km

logger = logging.getLogger(__name__)

OSRM_URL = os.getenv("OSRM_URL", "http://osrm:5000").rstrip('/')
TIMEOUT = 1.5

def get_driving_route(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """
    Queries OSRM backend for precise street driving route, distance and estimated travel time.
    Gracefully falls back to Haversine calculation if OSRM is offline or initializing.
    """
    endpoint = f"{OSRM_URL}/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson"
    try:
        res = requests.get(endpoint, timeout=TIMEOUT)
        if res.status_code == 200:
            data = res.json()
            if data.get('code') == 'Ok' and data.get('routes'):
                primary_route = data['routes'][0]
                geometry = primary_route.get('geometry', {})
                dist_km = round(primary_route['distance'] / 1000.0, 2)
                duration_mins = round(primary_route['duration'] / 60.0, 1)
                coords = [(lat, lng) for lng, lat in geometry.get('coordinates', [])]
                encoded_poly = ""
                try:
                    import polyline
                    encoded_poly = polyline.encode(coords)
                except Exception:
                    pass
                return {
                    'source': 'osrm',
                    'distance_km': Decimal(str(dist_km)),
                    'duration_minutes': duration_mins,
                    'geometry': geometry,
                    'polyline_encoded': encoded_poly,
                }
    except Exception as e:
        logger.debug(f"OSRM request fallback: {e}")

    # Fallback: Haversine with 1.25 curvature factor
    straight_dist = haversine_distance_km(origin_lat, origin_lng, dest_lat, dest_lng)
    estimated_driving_dist = Decimal(str(round(straight_dist * 1.25, 2)))
    # Estimate average speed 30 km/h in urban delivery
    estimated_minutes = round((float(estimated_driving_dist) / 30.0) * 60.0, 1)

    return {
        'source': 'haversine_fallback',
        'distance_km': estimated_driving_dist,
        'duration_minutes': max(5.0, estimated_minutes),
        'geometry': None,
    }


def snap_to_roads_map_matching(coordinates: list[tuple[float, float]]) -> list[dict]:
    """
    Takes an array of (lat, lng) GPS points reported by the driver and snaps them
    to real road network geometry using OSRM Match API.
    """
    if len(coordinates) < 2:
        return [{'lat': lat, 'lng': lng} for lat, lng in coordinates]

    coords_str = ";".join(f"{lng},{lat}" for lat, lng in coordinates)
    endpoint = f"{OSRM_URL}/match/v1/driving/{coords_str}?geometries=geojson&overview=full"

    try:
        res = requests.get(endpoint, timeout=TIMEOUT)
        if res.status_code == 200:
            data = res.json()
            if data.get('code') == 'Ok' and data.get('matchings'):
                matched_coords = data['matchings'][0]['geometry']['coordinates']
                return [{'lat': lat, 'lng': lng} for lng, lat in matched_coords]
    except Exception as e:
        logger.debug(f"OSRM Map Matching fallback: {e}")

    return [{'lat': lat, 'lng': lng} for lat, lng in coordinates]
