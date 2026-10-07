import os
import logging
import requests

logger = logging.getLogger(__name__)

VROOM_URL = os.getenv("VROOM_URL", "http://vroom:3000").rstrip('/')
TIMEOUT = 2.0

def optimize_driver_stops(driver_lat: float, driver_lng: float, stops: list[dict]) -> dict:
    """
    Optimizes multi-order pickup and delivery sequence for a single driver.
    Each stop in stops is:
    {
      'id': int,
      'type': 'pickup' or 'delivery',
      'lat': float,
      'lng': float,
      'description': str,
    }
    """
    if not stops:
        return {"routes": []}

    # Format into VROOM jobs payload
    jobs = []
    for idx, stop in enumerate(stops):
        jobs.append({
            "id": stop.get('id', idx + 1),
            "description": stop.get('description', f"Stop {idx + 1}"),
            "location": [float(stop['lng']), float(stop['lat'])],
            "service": 180, # 3 minutes handling time
        })

    payload = {
        "vehicles": [
            {
                "id": 1,
                "profile": "car",
                "start": [float(driver_lng), float(driver_lat)],
            }
        ],
        "jobs": jobs
    }

    try:
        res = requests.post(f"{VROOM_URL}/", json=payload, timeout=TIMEOUT)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        logger.debug(f"VROOM optimization fallback: {e}")

    # Fallback to FIFO order if VROOM is offline
    return {
        "code": 0,
        "fallback": True,
        "routes": [
            {
                "vehicle": 1,
                "steps": [{"type": "job", "id": s.get('id', i + 1)} for i, s in enumerate(stops)]
            }
        ]
    }
