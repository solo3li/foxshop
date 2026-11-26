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

    # 2. Broadcast DeliveryOffers to candidate drivers
    def _start_broadcast():
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return {"status": "order_not_found"}

        # F15: Cancelled Order Sleep Check - abort if order cancelled/delivered during preparation
        if order.status in (Order.Status.CANCELLED, Order.Status.DELIVERED):
            return {"status": "cancelled", "reason": f"Order is {order.status}"}

        from apps.restaurants.models import Restaurant
        if order.restaurant.delivery_mode == Restaurant.DeliveryMode.STORE_OWN_FLEET:
            return {"status": "skipped_store_own_fleet"}

        if hasattr(order, 'delivery_trip') and order.delivery_trip is not None:
            return {"status": "already_claimed"}

        from apps.deliveries.dispatch import find_candidate_drivers, broadcast_delivery_offers, DISPATCH_TIMEOUT_SECONDS
        candidates = find_candidate_drivers(order, radius_km=5.0, limit=3)
        if not candidates:
            candidates = find_candidate_drivers(order, radius_km=10.0, limit=5)

        if candidates:
            offers = broadcast_delivery_offers(
                order=order,
                candidate_drivers_with_dist=candidates,
                batch_number=1,
                timeout_seconds=DISPATCH_TIMEOUT_SECONDS
            )
            # Emit inngest event to monitor acceptance timeout
            try:
                inngest_client.send_sync(
                    inngest.Event(
                        name="delivery/offers.broadcasted",
                        data={
                            "order_id": str(order.id),
                            "batch": 1,
                            "timeout_seconds": DISPATCH_TIMEOUT_SECONDS
                        }
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to send delivery/offers.broadcasted event: {e}")
            return {"status": "broadcasted", "offers_count": len(offers), "order_id": str(order.id)}
        else:
            from apps.notifications.services import publish_centrifugo_event
            alert_payload = {
                'type': 'DISPATCH_FAILED_ALERT',
                'order_id': str(order.id),
                'order_number': order.order_number,
                'message': "لا يوجد كباتن متاحين حالياً ضمن نطاق التغطية. يتطلب تعييناً يدوياً من الإدارة.",
                'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            publish_centrifugo_event("supervisor:operations", "DISPATCH_FAILED_ALERT", alert_payload)
            publish_centrifugo_event("admin:alerts", "dispatch_alert", alert_payload)
            return {"status": "no_candidates"}

    return ctx.step.run("broadcast-candidate-drivers", _start_broadcast)


@inngest_client.create_function(
    fn_id="driver-offer-timeout-handler",
    trigger=inngest.TriggerEvent(event="delivery/offers.broadcasted"),
)
def fn_driver_offer_timeout_handler(ctx: inngest.ContextSync) -> dict:
    order_id = ctx.event.data.get("order_id")
    batch = int(ctx.event.data.get("batch", 1))
    timeout_secs = int(ctx.event.data.get("timeout_seconds", DISPATCH_TIMEOUT_SECONDS))

    # 1. Durable non-blocking sleep for the exact broadcast duration
    ctx.step.sleep("wait-broadcast-response", datetime.timedelta(seconds=timeout_secs))

    # 2. Check if any driver accepted, otherwise escalate or re-broadcast
    def _check_and_handle_timeout():
        from apps.deliveries.models import DeliveryOffer, DeliveryTrip
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return {"status": "order_not_found"}

        # F15: Cancelled Order Sleep Check - abort if order cancelled/delivered during preparation
        if order.status in (Order.Status.CANCELLED, Order.Status.DELIVERED):
            return {"status": "cancelled", "reason": f"Order is {order.status}"}

        from apps.restaurants.models import Restaurant
        if order.restaurant.delivery_mode == Restaurant.DeliveryMode.STORE_OWN_FLEET:
            return {"status": "skipped_store_own_fleet"}

        # If a trip already exists, someone claimed it
        if hasattr(order, 'delivery_trip') and order.delivery_trip is not None:
            return {"status": "claimed_successfully"}

        # Mark all pending offers from this batch as TIMED_OUT
        DeliveryOffer.objects.filter(
            order=order,
            batch_number=batch,
            status=DeliveryOffer.Status.PENDING
        ).update(status=DeliveryOffer.Status.TIMED_OUT)

        # Attempt next batch if within limit
        if batch < 3:
            from apps.deliveries.dispatch import find_candidate_drivers, broadcast_delivery_offers, DISPATCH_TIMEOUT_SECONDS
            radius = 10.0 if batch == 1 else 15.0
            candidates = find_candidate_drivers(order, radius_km=radius, limit=4)
            if candidates:
                offers = broadcast_delivery_offers(
                    order=order,
                    candidate_drivers_with_dist=candidates,
                    batch_number=batch + 1,
                    timeout_seconds=DISPATCH_TIMEOUT_SECONDS
                )
                try:
                    inngest_client.send_sync(
                        inngest.Event(
                            name="delivery/offers.broadcasted",
                            data={
                                "order_id": str(order.id),
                                "batch": batch + 1,
                                "timeout_seconds": DISPATCH_TIMEOUT_SECONDS
                            }
                        )
                    )
                except Exception as e:
                    logger.warning(f"Failed to send re-broadcast event: {e}")
                return {"status": "re_broadcasted", "batch": batch + 1, "offers_count": len(offers)}

        # Fallback: Alert Operations Admin
        from apps.notifications.services import publish_centrifugo_event
        publish_centrifugo_event(
            "admin:alerts",
            "dispatch_alert",
            {
                'type': 'DISPATCH_FAILED_ALERT',
                'order_id': str(order.id),
                'order_number': order.order_number,
                'message': f"فشلت محاولات التعيين التنافسي ({batch} دفعات). يرجى التعيين اليدوي من الإدارة فوراً."
            }
        )
        return {"status": "manual_dispatch_required"}

    return ctx.step.run("handle-broadcast-timeout", _check_and_handle_timeout)


@inngest_client.create_function(
    fn_id="weekly-vendor-payouts-cron",
    trigger=inngest.TriggerEvent(event="payments/weekly.payouts.manual"),
)
def fn_weekly_vendor_payouts_cron(ctx: inngest.ContextSync) -> dict:
    def _calculate_payouts():
        from django.utils import timezone
        from apps.payments.tasks import execute_weekly_payouts

        today = timezone.now().date()
        last_week_start = today - datetime.timedelta(days=7)
        last_week_end = today - datetime.timedelta(days=1)
        cycle_code = f"WEEK-{last_week_start.strftime('%Y-W%W')}"
        res = execute_weekly_payouts(last_week_start, last_week_end, cycle_code)
        if res.get('status') == 'already_closed':
            return {"status": "already_closed"}
        return {"cycle": cycle_code, "settled_restaurants": res.get('vendors_count', 0), **res}

    return ctx.step.run("execute-weekly-payouts", _calculate_payouts)


delivery_inngest_functions = [
    fn_order_auto_dispatch_flow,
    fn_driver_offer_timeout_handler,
    fn_weekly_vendor_payouts_cron,
]
