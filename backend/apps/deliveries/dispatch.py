import logging
from django.utils import timezone
from django.core.cache import cache
from apps.deliveries.models import DriverProfile, DeliveryTrip
from apps.accounts.models import PlatformSetting, User
from apps.restaurants.models import haversine_distance_km
from apps.notifications.services import publish_centrifugo_event

logger = logging.getLogger(__name__)

DISPATCH_TIMEOUT_SECONDS = 60
MAX_DISPATCH_ATTEMPTS = 5

def get_rejected_drivers_cache_key(trip_id):
    return f"trip:{trip_id}:rejected_drivers"

def find_candidate_driver(trip, radius_km=5.0):
    restaurant = trip.order.restaurant
    rest_lat = float(restaurant.latitude)
    rest_lng = float(restaurant.longitude)

    settings = PlatformSetting.get_settings()
    max_cod = float(settings.cod_max_ceiling)

    # Get list of driver IDs who already rejected or timed out
    rejected_ids = cache.get(get_rejected_drivers_cache_key(trip.id)) or []

    # Query active, online, non-busy drivers
    candidates = DriverProfile.objects.filter(
        is_online=True,
        is_busy=False,
        cash_in_hand__lte=max_cod
    ).exclude(user_id__in=rejected_ids).select_related('user')

    closest_driver = None
    min_dist = float('inf')

    # Expand search radius if needed up to 10 km
    search_radius = radius_km if trip.dispatch_attempts < 3 else 10.0

    for profile in candidates:
        if profile.current_latitude and profile.current_longitude:
            dist = haversine_distance_km(
                rest_lat, rest_lng,
                float(profile.current_latitude), float(profile.current_longitude)
            )
            if dist <= search_radius and dist < min_dist:
                min_dist = dist
                closest_driver = profile.user

    return closest_driver, min_dist

def offer_trip_to_driver(trip, driver, attempt_number):
    trip.status = DeliveryTrip.Status.OFFERED
    trip.last_offered_to = driver
    trip.dispatch_attempts = attempt_number
    trip.save(update_fields=['status', 'last_offered_to', 'dispatch_attempts'])

    # Lock this trip to the driver in Redis for 60 seconds
    lock_key = f"trip:{trip.id}:offered_driver"
    cache.set(lock_key, str(driver.id), timeout=DISPATCH_TIMEOUT_SECONDS)

    # Publish real-time event to driver's private channel
    order = trip.order
    event_data = {
        'trip_id': str(trip.id),
        'order_number': order.order_number,
        'restaurant_name': order.restaurant.name,
        'restaurant_address': order.restaurant.address_text,
        'delivery_fee': float(trip.driver_earnings or order.delivery_fee),
        'timeout_seconds': DISPATCH_TIMEOUT_SECONDS,
        'attempt': attempt_number,
    }
    publish_centrifugo_event(f"driver_{driver.id}", "dispatch_offer", event_data)
    logger.info(f"Offered trip {trip.id} to driver {driver.username} (Attempt {attempt_number})")
    return True

def handle_driver_timeout_or_rejection(trip_id, driver_id):
    try:
        trip = DeliveryTrip.objects.get(id=trip_id)
    except DeliveryTrip.DoesNotExist:
        return

    # If trip was already accepted, do nothing
    if trip.status == DeliveryTrip.Status.ACCEPTED or trip.driver is not None:
        return

    # Add this driver to the rejected list for this trip
    rejected_key = get_rejected_drivers_cache_key(trip_id)
    rejected_ids = cache.get(rejected_key) or []
    if str(driver_id) not in rejected_ids:
        rejected_ids.append(str(driver_id))
        cache.set(rejected_key, rejected_ids, timeout=3600)

    # Check attempt limit
    next_attempt = trip.dispatch_attempts + 1
    if next_attempt <= MAX_DISPATCH_ATTEMPTS:
        candidate, dist = find_candidate_driver(trip)
        if candidate:
            offer_trip_to_driver(trip, candidate, next_attempt)
            from apps.deliveries.tasks import task_check_driver_timeout
            task_check_driver_timeout.apply_async((str(trip.id), str(candidate.id)), countdown=DISPATCH_TIMEOUT_SECONDS)
            return
        else:
            logger.warning(f"No candidate driver found for trip {trip.id} on attempt {next_attempt}")

    # Fallback: Alert Operations Admin
    trip.status = DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED
    trip.save(update_fields=['status'])
    
    alert_payload = {
        'type': 'DISPATCH_FAILED_ALERT',
        'trip_id': str(trip.id),
        'order_number': trip.order.order_number,
        'restaurant_name': trip.order.restaurant.name,
        'message': f"فشل التعيين الآلي بعد {trip.dispatch_attempts} محاولات. يرجى التعيين اليدوي فوراً.",
        'timestamp': timezone.now().isoformat()
    }
    publish_centrifugo_event("admin:alerts", "dispatch_alert", alert_payload)
    logger.critical(f"Trip {trip.id} requires MANUAL dispatch after {trip.dispatch_attempts} failed attempts.")
