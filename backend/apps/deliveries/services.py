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
    """Updates driver GPS in DB, Redis Geospatial, and broadcasts via Centrifugo"""
    import json
    import time
    lat = float(latitude)
    lon = float(longitude)
    hdg = float(heading or 0.0)
    spd = float(speed or 0.0)

    # 1. Update Profile in DB (only if coordinates meaningfully changed or periodically)
    if hasattr(driver_user, 'driver_profile'):
        profile = driver_user.driver_profile
        profile.current_latitude = lat
        profile.current_longitude = lon
        profile.save(update_fields=['current_latitude', 'current_longitude'])

    # 2. Update Redis Geospatial & Fast In-Memory Location Cache
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
                    'timestamp': time.time()
                }),
                ex=300
            )
        except Exception as e:
            logger.warning(f"Redis GPS update warning: {e}")

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
            channel=f"tracking:order_{active_trip.order.id}",
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
