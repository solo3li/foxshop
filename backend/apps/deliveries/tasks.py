import logging
from decimal import Decimal
from celery import shared_task
from apps.deliveries.models import DeliveryTrip
from apps.orders.models import Order
from apps.deliveries.dispatch import (
    find_candidate_driver,
    offer_trip_to_driver,
    handle_driver_timeout_or_rejection,
    DISPATCH_TIMEOUT_SECONDS
)

logger = logging.getLogger(__name__)

@shared_task
def task_start_auto_dispatch(trip_id):
    try:
        trip = DeliveryTrip.objects.get(id=trip_id)
    except DeliveryTrip.DoesNotExist:
        logger.error(f"DeliveryTrip {trip_id} not found for dispatch.")
        return

    if trip.status == DeliveryTrip.Status.ACCEPTED or trip.driver is not None:
        return

    candidate, dist = find_candidate_driver(trip)
    if candidate:
        offer_trip_to_driver(trip, candidate, attempt_number=1)
        task_check_driver_timeout.apply_async(
            args=[str(trip.id), str(candidate.id)],
            countdown=DISPATCH_TIMEOUT_SECONDS
        )
    else:
        # No driver found on initial attempt, trigger timeout handler to retry or alert
        handle_driver_timeout_or_rejection(trip.id, driver_id=None)

@shared_task
def task_check_driver_timeout(trip_id, driver_id):
    handle_driver_timeout_or_rejection(trip_id, driver_id)

@shared_task
def task_schedule_order_dispatch(order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return

    trip, _ = DeliveryTrip.objects.get_or_create(
        order=order,
        defaults={
            'status': DeliveryTrip.Status.DISPATCHING,
            'driver_earnings': round(order.delivery_fee * Decimal('0.8'), 2)  # 80% to driver
        }
    )

    prep_minutes = order.prep_time_minutes or 25
    # Schedule dispatch 5 minutes before food readiness
    dispatch_delay_seconds = max(0, (prep_minutes - 5) * 60)
    
    logger.info(f"Scheduling auto-dispatch for order {order.order_number} in {dispatch_delay_seconds} seconds (prep time: {prep_minutes}m)")
    task_start_auto_dispatch.apply_async(args=[str(trip.id)], countdown=dispatch_delay_seconds)
