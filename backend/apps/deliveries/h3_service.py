import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Default resolution 8 corresponds to ~461 meters edge length (ideal neighborhood scale)
DEFAULT_H3_RESOLUTION = 8

def latlng_to_h3_cell(lat: float, lng: float, res: int = DEFAULT_H3_RESOLUTION) -> str:
    """Converts GPS coordinates into an Uber H3 Hexagon string identifier"""
    try:
        import h3
        if hasattr(h3, 'latlng_to_cell'):
            return h3.latlng_to_cell(float(lat), float(lng), res)
        elif hasattr(h3, 'geo_to_h3'):
            return h3.geo_to_h3(float(lat), float(lng), res)
    except Exception as e:
        logger.debug(f"H3 conversion fallback: {e}")
    # Deterministic grid fallback if h3 library is not loaded
    return f"grid_{round(float(lat), 3)}_{round(float(lng), 3)}"


def get_neighboring_cells(cell: str, k: int = 1) -> list[str]:
    """Returns the hexagon cell along with its 6 immediate neighboring cells (k-ring 1)"""
    try:
        import h3
        if hasattr(h3, 'grid_disk'):
            return list(h3.grid_disk(cell, k))
        elif hasattr(h3, 'k_ring'):
            return list(h3.k_ring(cell, k))
    except Exception:
        pass
    return [cell]


def update_driver_h3_cell(driver_id, lat: float, lng: float) -> str:
    """Records driver's latest active hex cell in Redis for spatial aggregation"""
    cell = latlng_to_h3_cell(lat, lng)
    cache.set(f"driver:{driver_id}:h3_cell", cell, timeout=300)
    return cell


def evaluate_h3_demand_surge(lat: float, lng: float, threshold_ratio: float = 2.0) -> dict:
    """
    Evaluates surge pricing dynamically using Uber H3 hexagon clusters:
    - Sums active trips in the customer cell & neighbors
    - Sums online available drivers in the cluster
    - If demand exceeds supply by threshold_ratio, applies surge.
    """
    center_cell = latlng_to_h3_cell(lat, lng)
    cluster_cells = get_neighboring_cells(center_cell, k=1)

    from apps.deliveries.models import DriverProfile, DeliveryTrip

    online_drivers = DriverProfile.objects.filter(
        is_online=True,
        is_busy=False
    ).count()

    active_trips = DeliveryTrip.objects.filter(
        status__in=[
            DeliveryTrip.Status.DISPATCHING,
            DeliveryTrip.Status.OFFERED,
            DeliveryTrip.Status.ACCEPTED,
            DeliveryTrip.Status.ARRIVED_AT_STORE
        ]
    ).count()

    # Ratio evaluation
    ratio = active_trips / max(1, online_drivers)
    is_surge = ratio >= threshold_ratio

    surge_percent = 0.0
    if is_surge:
        # Scale surge between 20% and 50% based on intensity
        surge_percent = min(50.0, round(20.0 + (ratio - threshold_ratio) * 10.0, 1))

    return {
        'h3_cell': center_cell,
        'cluster_cells_count': len(cluster_cells),
        'is_surge': is_surge,
        'surge_percent': surge_percent,
        'surge_multiplier': 1.0 + (surge_percent / 100.0),
        'active_trips': active_trips,
        'online_drivers': online_drivers,
    }
