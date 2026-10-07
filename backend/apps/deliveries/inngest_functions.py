import logging
import datetime
from decimal import Decimal
import inngest
from core.inngest_client import inngest_client
from apps.deliveries.models import DeliveryTrip
from apps.orders.models import Order
from apps.deliveries.dispatch import (
    find_candidate_driver,
    offer_trip_to_driver,
    handle_driver_timeout_or_rejection,
    DISPATCH_TIMEOUT_SECONDS
)

logger = logging.getLogger(__name__)


@inngest_client.create_function(
    fn_id="order-auto-dispatch-flow",
    trigger=inngest.TriggerEvent(event="order/prep.scheduled"),
)
def fn_order_auto_dispatch_flow(ctx: inngest.ContextSync) -> dict:
    order_id = ctx.event.data.get("order_id")
    prep_minutes = int(ctx.event.data.get("prep_minutes", 25))
    
    # 1. Delay dispatch until food is almost ready (prep_minutes - 5)
    dispatch_delay_seconds = max(0, (prep_minutes - 5) * 60)
    if dispatch_delay_seconds > 0:
        ctx.step.sleep("wait-near-food-readiness", datetime.timedelta(seconds=dispatch_delay_seconds))

    # 2. Get or create DeliveryTrip and start dispatch
    def _start_dispatch():
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return {"status": "order_not_found"}

        trip, _ = DeliveryTrip.objects.get_or_create(
            order=order,
            defaults={
                'status': DeliveryTrip.Status.DISPATCHING,
                'driver_earnings': round(order.delivery_fee * Decimal('0.8'), 2)
            }
        )
        if trip.status == DeliveryTrip.Status.ACCEPTED or trip.driver is not None:
            return {"status": "already_accepted"}

        candidate, dist = find_candidate_driver(trip)
        if candidate:
            offer_trip_to_driver(trip, candidate, attempt_number=1)
            # Emit inngest event to start 60s timer
            inngest_client.send_sync(
                inngest.Event(
                    name="delivery/trip.offered",
                    data={
                        "trip_id": str(trip.id),
                        "driver_id": str(candidate.id),
                        "attempt": 1
                    }
                )
            )
            return {"status": "offered", "trip_id": str(trip.id), "driver_id": str(candidate.id)}
        else:
            trip.status = DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED
            trip.save(update_fields=['status'])
            return {"status": "no_candidate"}

    return ctx.step.run("dispatch-candidate-driver", _start_dispatch)


@inngest_client.create_function(
    fn_id="driver-offer-timeout-handler",
    trigger=inngest.TriggerEvent(event="delivery/trip.offered"),
)
def fn_driver_offer_timeout_handler(ctx: inngest.ContextSync) -> dict:
    trip_id = ctx.event.data.get("trip_id")
    driver_id = ctx.event.data.get("driver_id")
    timeout_secs = int(ctx.event.data.get("timeout_seconds", DISPATCH_TIMEOUT_SECONDS))

    # 1. Durable non-blocking sleep for the exact offer duration
    ctx.step.sleep("wait-driver-acceptance", datetime.timedelta(seconds=timeout_secs))

    # 2. Check if driver accepted, otherwise re-dispatch
    def _check_and_handle_timeout():
        try:
            trip = DeliveryTrip.objects.get(id=trip_id)
        except DeliveryTrip.DoesNotExist:
            return {"status": "trip_not_found"}

        if trip.status == DeliveryTrip.Status.ACCEPTED or trip.driver is not None:
            return {"status": "accepted_by_driver"}

        # Timeout occurred: rotate driver
        handle_driver_timeout_or_rejection(trip_id, driver_id)
        return {"status": "timed_out_and_rotated"}

    return ctx.step.run("handle-driver-timeout", _check_and_handle_timeout)


@inngest_client.create_function(
    fn_id="weekly-vendor-payouts-cron",
    trigger=inngest.TriggerCron(cron="0 0 * * 1"), # Every Monday at 00:00 UTC
)
def fn_weekly_vendor_payouts_cron(ctx: inngest.ContextSync) -> dict:
    def _calculate_payouts():
        from apps.payments.models import PayoutCycle, VendorPayout
        from apps.restaurants.models import Restaurant
        from apps.orders.models import Order
        from django.utils import timezone
        import datetime

        today = timezone.now().date()
        last_week_start = today - datetime.timedelta(days=7)
        cycle_code = f"WEEK-{last_week_start.strftime('%Y-%U')}"

        cycle, created = PayoutCycle.objects.get_or_create(
            cycle_code=cycle_code,
            defaults={'start_date': last_week_start, 'end_date': today - datetime.timedelta(days=1)}
        )
        if not created and cycle.is_closed:
            return {"status": "already_closed"}

        restaurants = Restaurant.objects.filter(is_active=True)
        count = 0
        for rest in restaurants:
            orders = Order.objects.filter(
                restaurant=rest,
                status=Order.Status.DELIVERED,
                created_at__date__gte=cycle.start_date,
                created_at__date__lte=cycle.end_date
            )
            if not orders.exists():
                continue
            gross = sum(o.subtotal for o in orders)
            comm_rate = Decimal('15.00')
            comm_amount = round((gross * comm_rate) / Decimal('100.00'), 2)
            net = gross - comm_amount

            VendorPayout.objects.update_or_create(
                cycle=cycle,
                restaurant=rest,
                defaults={
                    'orders_count': orders.count(),
                    'gross_sales': gross,
                    'commission_rate': comm_rate,
                    'commission_amount': comm_amount,
                    'net_payout': net
                }
            )
            count += 1
        return {"cycle": cycle_code, "settled_restaurants": count}

    return ctx.step.run("execute-weekly-payouts", _calculate_payouts)


delivery_inngest_functions = [
    fn_order_auto_dispatch_flow,
    fn_driver_offer_timeout_handler,
    fn_weekly_vendor_payouts_cron,
]
