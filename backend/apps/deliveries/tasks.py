import logging
from decimal import Decimal
from apps.deliveries.models import DeliveryTrip
from apps.orders.models import Order
from apps.deliveries.dispatch import (
    find_candidate_driver,
    offer_trip_to_driver,
    handle_driver_timeout_or_rejection,
    DISPATCH_TIMEOUT_SECONDS
)

logger = logging.getLogger(__name__)


def _task_start_auto_dispatch(trip_id):
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
    else:
        handle_driver_timeout_or_rejection(trip.id, driver_id=None)


def _task_check_driver_timeout(trip_id, driver_id):
    handle_driver_timeout_or_rejection(trip_id, driver_id)


def _task_schedule_order_dispatch(order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return

    trip, _ = DeliveryTrip.objects.get_or_create(
        order=order,
        defaults={
            'status': DeliveryTrip.Status.DISPATCHING,
            'driver_earnings': round(order.delivery_fee * Decimal('0.8'), 2)
        }
    )


class TaskCallableWrapper:
    def __init__(self, func):
        self.func = func
        self.__name__ = func.__name__

    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)

    def delay(self, *args, **kwargs):
        return self.func(*args, **kwargs)

    def apply_async(self, args=None, kwargs=None, **options):
        args = args or ()
        kwargs = kwargs or {}
        return self.func(*args, **kwargs)


task_start_auto_dispatch = TaskCallableWrapper(_task_start_auto_dispatch)
task_check_driver_timeout = TaskCallableWrapper(_task_check_driver_timeout)
task_schedule_order_dispatch = TaskCallableWrapper(_task_schedule_order_dispatch)
