import logging
from django.conf import settings
from django.core.cache import cache
from .models import DriverProfile, DeliveryTrip
from apps.orders.models import Order
from apps.notifications.services import publish_centrifugo_event
from apps.restaurants.models import haversine_distance_km

logger = logging.getLogger(__name__)

def get_redis_client():
    try:
        import redis
        return redis.from_url(settings.REDIS_URL)
    except Exception:
        return None

def update_driver_gps(driver_user, latitude, longitude, heading=0.0, speed=0.0):
    """Updates driver GPS in Redis Geospatial, throttles DB write-behind, and broadcasts via Centrifugo"""
    import json
    import time
    lat = float(latitude)
    lon = float(longitude)
    hdg = float(heading or 0.0)
    spd = float(speed or 0.0)
    now_ts = time.time()

    # 1. Update Redis Geospatial & Fast In-Memory Location Cache (always)
    r = get_redis_client()
    if r:
        try:
            r.geoadd("drivers:active", (lon, lat, str(driver_user.id)))
            # Fast in-memory key with 5-minute TTL for zero-DB lookups
            r.set(
                f"driver:{driver_user.id}:pos",
                json.dumps({
                    'latitude': lat,
                    'longitude': lon,
                    'heading': hdg,
                    'speed': spd,
                    'timestamp': now_ts
                }),
                ex=300
            )
        except Exception as e:
            logger.warning(f"Redis GPS update warning: {e}")

    # 2. Write-behind throttling to PostgreSQL:
    # Only update DB if not updated recently (>= 15s) or distance moved >= 0.5km
    throttle_key = f"driver_gps_throttled_{driver_user.id}"
    last_gps = cache.get(throttle_key)
    should_write_db = False
    if not last_gps:
        should_write_db = True
    else:
        last_lat, last_lon, last_time = last_gps
        elapsed = now_ts - last_time
        dist = haversine_distance_km(lat, lon, last_lat, last_lon)
        if elapsed >= 15.0 or dist >= 0.5:
            should_write_db = True

    if should_write_db and hasattr(driver_user, 'driver_profile'):
        profile = driver_user.driver_profile
        profile.current_latitude = lat
        profile.current_longitude = lon
        profile.save(update_fields=['current_latitude', 'current_longitude'])
        cache.set(throttle_key, (lat, lon, now_ts), timeout=30)

    # 3. Broadcast to Centrifugo in real-time if on an active delivery
    active_trip = DeliveryTrip.objects.filter(
        driver=driver_user,
        status__in=[
            DeliveryTrip.Status.ACCEPTED,
            DeliveryTrip.Status.ARRIVED_AT_STORE,
            DeliveryTrip.Status.PICKED_UP,
            DeliveryTrip.Status.ARRIVED_AT_CUSTOMER
        ]
    ).select_related('order').first()

    if active_trip:
        loc_data = {
            'driver_id': str(driver_user.id),
            'order_id': str(active_trip.order.id),
            'trip_id': str(active_trip.id),
            'latitude': lat,
            'longitude': lon,
            'heading': hdg,
            'speed': spd,
            'trip_status': active_trip.status
        }
        # Publish to customer order tracking channel
        publish_centrifugo_event(
            channel=f"orders:order_{active_trip.order.id}",
            event_type="DRIVER_LOCATION",
            data=loc_data
        )
        # Publish to driver trip channel
        publish_centrifugo_event(
            channel=f"trip:{active_trip.id}",
            event_type="DRIVER_LOCATION",
            data=loc_data
        )

def find_nearest_driver(restaurant_lat, restaurant_lon, max_radius_km=10.0):
    """Finds the nearest online and idle driver"""
    available_drivers = DriverProfile.objects.filter(
        is_online=True,
        is_busy=False,
        current_latitude__isnull=False,
        current_longitude__isnull=False
    ).select_related('user')

    best_driver = None
    min_dist = max_radius_km

    for dp in available_drivers:
        dist = haversine_distance_km(restaurant_lat, restaurant_lon, dp.current_latitude, dp.current_longitude)
        if dist < min_dist:
            min_dist = dist
            best_driver = dp.user

    return best_driver, min_dist

def create_and_dispatch_trip(order):
    """Initiates delivery trip and assigns closest driver"""
    trip, created = DeliveryTrip.objects.get_or_create(
        order=order,
        defaults={
            'driver_earnings': round(float(order.delivery_fee) * 0.8, 2),
        }
    )

    driver, dist = find_nearest_driver(order.restaurant.latitude, order.restaurant.longitude)
    if driver:
        trip.driver = driver
        trip.distance_km = round(dist, 2)
        trip.status = DeliveryTrip.Status.OFFERED
        trip.save()

        # Mark driver busy
        driver.driver_profile.is_busy = True
        driver.driver_profile.save(update_fields=['is_busy'])

        # Notify driver in real-time
        publish_centrifugo_event(
            channel=f"orders:driver_{driver.id}",
            event_type="NEW_DELIVERY_OFFER",
            data={
                'trip_id': str(trip.id),
                'order_number': order.order_number,
                'restaurant_name': order.restaurant.name,
                'earnings': str(trip.driver_earnings),
                'distance_km': trip.distance_km
            }
        )
    return trip


def flush_driver_gps_write_behind():
    """Syncs cached driver GPS locations from Redis to PostgreSQL DriverProfile."""
    import json
    r = get_redis_client()
    if not r:
        return 0

    synced_count = 0
    try:
        keys = []
        if hasattr(r, '_geo') and 'drivers:active' in r._geo:
            keys = [f"driver:{k}:pos" for k in r._geo['drivers:active'].keys()]
        if hasattr(r, '_data'):
            keys = list(set(keys + [k for k in r._data.keys() if k.startswith('driver:') and k.endswith(':pos')]))
        if not keys and hasattr(r, 'keys'):
            try:
                keys = [k.decode('utf-8') if isinstance(k, bytes) else k for k in r.keys('driver:*:pos')]
            except Exception:
                keys = []

        for key in keys:
            pos_raw = r.get(key)
            if pos_raw:
                try:
                    pos = json.loads(pos_raw)
                    lat = pos.get('latitude')
                    lon = pos.get('longitude')
                    parts = key.split(':')
                    if len(parts) >= 2:
                        drv_id = parts[1]
                        if lat is not None and lon is not None:
                            DriverProfile.objects.filter(user_id=drv_id).update(
                                current_latitude=lat,
                                current_longitude=lon
                            )
                            synced_count += 1
                except Exception as ex:
                    logger.warning(f"Error parsing driver pos for {key}: {ex}")
    except Exception as e:
        logger.warning(f"Error in flush_driver_gps_write_behind: {e}")
    return synced_count


sync_driver_gps_to_db = flush_driver_gps_write_behind
persist_driver_locations_to_db = flush_driver_gps_write_behind
sync_redis_driver_locations_to_postgres = flush_driver_gps_write_behind
