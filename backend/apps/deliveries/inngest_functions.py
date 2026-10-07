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
            return {"status": "broadcasted", "offers_count": len(offers), "order_id": str(order.id)}
        else:
            from apps.notifications.services import publish_centrifugo_event
            publish_centrifugo_event(
                "admin:alerts",
                "dispatch_alert",
                {
                    'type': 'DISPATCH_FAILED_ALERT',
                    'order_id': str(order.id),
                    'order_number': order.order_number,
                    'message': "لا يوجد كباتن متاحين حالياً ضمن نطاق التغطية. يتطلب تعييناً يدوياً من الإدارة."
                }
            )
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
