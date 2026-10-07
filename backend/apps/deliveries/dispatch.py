import logging
from decimal import Decimal
import datetime
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from apps.deliveries.models import DriverProfile, DeliveryTrip, DeliveryOffer
from apps.accounts.models import PlatformSetting, User
from apps.restaurants.models import haversine_distance_km
from apps.notifications.services import publish_centrifugo_event

logger = logging.getLogger(__name__)

DISPATCH_TIMEOUT_SECONDS = 45
MAX_DISPATCH_ATTEMPTS = 5


def get_rejected_drivers_cache_key(order_id):
    return f"order:{order_id}:rejected_drivers"


def find_candidate_drivers(order, radius_km=5.0, limit=3, exclude_user_ids=None):
    """Finds up to `limit` active, online, non-busy drivers near the order's restaurant."""
    restaurant = order.restaurant
    rest_lat = float(restaurant.latitude)
    rest_lng = float(restaurant.longitude)

    settings = PlatformSetting.get_settings()
    max_cod = float(settings.cod_max_ceiling)

    raw_rejected = cache.get(get_rejected_drivers_cache_key(order.id)) or []
    rejected_ids = [uid for uid in raw_rejected if uid and str(uid) != 'None']
    if exclude_user_ids:
        rejected_ids.extend([str(uid) for uid in exclude_user_ids])

    # Query active, online, non-busy drivers
    candidates = DriverProfile.objects.filter(
        is_online=True,
        is_busy=False,
        cash_in_hand__lte=max_cod
    )
    if rejected_ids:
        candidates = candidates.exclude(user_id__in=rejected_ids)
    candidates = candidates.select_related('user')

    driver_distances = []
    for profile in candidates:
        if profile.current_latitude and profile.current_longitude:
            dist = haversine_distance_km(
                rest_lat, rest_lng,
                float(profile.current_latitude), float(profile.current_longitude)
            )
            if dist <= radius_km:
                driver_distances.append((profile.user, round(dist, 2)))

    # Sort by closest distance first
    driver_distances.sort(key=lambda x: x[1])
    return driver_distances[:limit]


def broadcast_delivery_offers(order, candidate_drivers_with_dist, batch_number=1, timeout_seconds=DISPATCH_TIMEOUT_SECONDS, is_manual=False):
    """
    Broadcasts DeliveryOffer records to a batch of candidate drivers in parallel.
    Returns list of created DeliveryOffer objects.
    """
    now = timezone.now()
    expires_at = now + datetime.timedelta(seconds=timeout_seconds)
    driver_earnings = round(order.delivery_fee * Decimal('0.8'), 2)
    created_offers = []

    for driver, dist in candidate_drivers_with_dist:
        offer = DeliveryOffer.objects.create(
            order=order,
            driver=driver,
            batch_number=batch_number,
            status=DeliveryOffer.Status.PENDING,
            driver_earnings=driver_earnings,
            estimated_distance_km=dist,
            is_manual=is_manual,
            expires_at=expires_at
        )
        created_offers.append(offer)

        # Real-time WebSocket event directly to driver's private channel
        trip_data = {
            'id': str(offer.id),
            'order_id': str(order.id),
            'order_number': order.order_number,
            'restaurant': {
                'id': str(order.restaurant.id),
                'name': order.restaurant.name,
                'address_text': order.restaurant.address_text or '',
                'latitude': float(order.restaurant.latitude or 0),
                'longitude': float(order.restaurant.longitude or 0),
            },
            'restaurant_name': order.restaurant.name,
            'restaurant_address': order.restaurant.address_text or '',
            'estimated_distance_km': dist,
            'distance_km': dist,
            'driver_earnings': str(driver_earnings),
            'timeout_seconds': timeout_seconds,
            'expires_at': expires_at.isoformat(),
            'is_manual': is_manual,
            'status': 'OFFERED',
        }
        # Publish to standard driver channel listened to by the mobile app
        publish_centrifugo_event(f"orders:driver_{driver.id}", "NEW_DELIVERY_OFFER", {'trip': trip_data, **trip_data})
        # Publish to direct driver channel
        publish_centrifugo_event(f"driver_{driver.id}", "dispatch_offer", trip_data)
        logger.info(f"Broadcasted offer {offer.id} to driver {driver.username} (Batch {batch_number}, Dist: {dist}km, Manual: {is_manual})")

    return created_offers


def send_manual_offer_to_drivers(order, drivers, timeout_seconds=60):
    """Admin Manual Dispatch: Sends immediate DeliveryOffer to specifically chosen driver(s)."""
    restaurant = order.restaurant
    rest_lat = float(restaurant.latitude)
    rest_lng = float(restaurant.longitude)

    candidates_with_dist = []
    for driver in drivers:
        dist = 0.0
        if hasattr(driver, 'driver_profile') and driver.driver_profile.current_latitude:
            dist = round(haversine_distance_km(
                rest_lat, rest_lng,
                float(driver.driver_profile.current_latitude), float(driver.driver_profile.current_longitude)
            ), 2)
        candidates_with_dist.append((driver, dist))

    next_batch = (order.delivery_offers.count() or 0) + 1
    offers = broadcast_delivery_offers(
        order=order,
        candidate_drivers_with_dist=candidates_with_dist,
        batch_number=next_batch,
        timeout_seconds=timeout_seconds,
        is_manual=True
    )
    return offers


def accept_delivery_offer(offer_id, driver_user):
    """
    Thread-safe atomic acceptance of an offer:
    Ensures that only ONE driver wins the trip.
    Creates DeliveryTrip only at this moment.
    Marks competing offers as EXPIRED.
    """
    with transaction.atomic():
        try:
            offer = DeliveryOffer.objects.select_for_update().get(id=offer_id, driver=driver_user)
        except DeliveryOffer.DoesNotExist:
            return False, "عرض التوصيل غير موجود أو لا ينتمي لهذا الحساب"

        now = timezone.now()
        if offer.status != DeliveryOffer.Status.PENDING:
            return False, f"العرض غير متاح حالياً (حالته: {offer.get_status_display()})"

        if offer.expires_at < now:
            offer.status = DeliveryOffer.Status.TIMED_OUT
            offer.save(update_fields=['status'])
            return False, "عذراً، انتهت مهلة قبول هذا العرض"

        order = offer.order
        # Verify order hasn't already been assigned to a trip
        if hasattr(order, 'delivery_trip') and order.delivery_trip is not None:
            offer.status = DeliveryOffer.Status.EXPIRED
            offer.save(update_fields=['status'])
            return False, "عذراً! تم حجز الطلب بواسطة كابتن آخر بأسبقية القبول 💨"

        # Winner driver accepted!
        offer.status = DeliveryOffer.Status.ACCEPTED
        offer.responded_at = now
        offer.response_time_seconds = round((now - offer.offered_at).total_seconds(), 1)
        offer.save(update_fields=['status', 'responded_at', 'response_time_seconds'])

        # Create DeliveryTrip now!
        trip = DeliveryTrip.objects.create(
            order=order,
            driver=driver_user,
            status=DeliveryTrip.Status.ACCEPTED,
            distance_km=offer.estimated_distance_km,
            driver_earnings=offer.driver_earnings,
            accepted_at=now
        )

        # Mark other competing pending offers for this order as EXPIRED
        competing_offers = DeliveryOffer.objects.filter(
            order=order,
            status=DeliveryOffer.Status.PENDING
        ).exclude(id=offer.id)

        competing_driver_ids = list(competing_offers.values_list('driver_id', flat=True))
        competing_offers.update(status=DeliveryOffer.Status.EXPIRED)

        # Notify other drivers that the offer expired / was claimed
        for other_driver_id in competing_driver_ids:
            publish_centrifugo_event(
                f"driver_{other_driver_id}",
                "offer_expired",
                {'order_number': order.order_number, 'message': 'تم حجز الطلب بواسطة كابتن آخر'}
            )

        # Set driver profile to busy
        if hasattr(driver_user, 'driver_profile'):
            profile = driver_user.driver_profile
            profile.is_busy = True
            profile.save(update_fields=['is_busy'])

        # Notify customer and restaurant
        publish_centrifugo_event(
            channel=f"orders:order_{order.id}",
            event_type="DRIVER_ASSIGNED",
            data={
                'driver_name': driver_user.get_full_name() or driver_user.username,
                'driver_phone': driver_user.phone_number,
                'trip_id': str(trip.id)
            }
        )

        logger.info(f"Offer {offer.id} accepted by {driver_user.username}. Trip {trip.id} created!")
        return True, trip


def reject_delivery_offer(offer_id, driver_user):
    """Driver explicitly rejects the offer."""
    try:
        offer = DeliveryOffer.objects.get(id=offer_id, driver=driver_user)
    except DeliveryOffer.DoesNotExist:
        return False, "العرض غير موجود"

    if offer.status == DeliveryOffer.Status.PENDING:
        offer.status = DeliveryOffer.Status.REJECTED
        offer.responded_at = timezone.now()
        offer.response_time_seconds = round((offer.responded_at - offer.offered_at).total_seconds(), 1)
        offer.save(update_fields=['status', 'responded_at', 'response_time_seconds'])

        # Add to rejected cache
        rejected_key = get_rejected_drivers_cache_key(offer.order_id)
        rejected_ids = cache.get(rejected_key) or []
        if str(driver_user.id) not in rejected_ids:
            rejected_ids.append(str(driver_user.id))
            cache.set(rejected_key, rejected_ids, timeout=3600)

        return True, "تم رفض العرض"
    return False, "العرض لم يعد نشطاً"


# Backward compatibility aliases
def find_candidate_driver(trip, radius_km=5.0):
    candidates = find_candidate_drivers(trip.order, radius_km=radius_km, limit=1)
    if candidates:
        return candidates[0][0], candidates[0][1]
    return None, float('inf')

def offer_trip_to_driver(trip, driver, attempt_number):
    created = broadcast_delivery_offers(trip.order, [(driver, trip.distance_km)], batch_number=attempt_number)
    return len(created) > 0

def handle_driver_timeout_or_rejection(trip_id, driver_id):
    pass

