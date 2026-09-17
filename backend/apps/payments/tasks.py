import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count
from celery import shared_task
from apps.payments.models import PayoutCycle, VendorPayout, DriverPayout
from apps.restaurants.models import Restaurant
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip
from apps.accounts.models import PlatformSetting, User

logger = logging.getLogger(__name__)

@shared_task
def generate_weekly_payouts():
    today = timezone.now().date()
    # Calculate previous Monday to Sunday
    last_monday = today - timedelta(days=today.weekday() + 7)
    last_sunday = last_monday + timedelta(days=6)
    
    cycle_code = f"WEEK-{last_monday.strftime('%Y-W%W')}"
    
    cycle, created = PayoutCycle.objects.get_or_create(
        cycle_code=cycle_code,
        defaults={
            'start_date': last_monday,
            'end_date': last_sunday,
            'is_closed': False
        }
    )

    platform_setting = PlatformSetting.get_settings()
    default_comm_rate = float(platform_setting.platform_commission_percent)

    # 1. Generate Vendor Payouts
    restaurants = Restaurant.objects.filter(is_active=True)
    vendor_payouts_count = 0

    for rest in restaurants:
        orders = Order.objects.filter(
            restaurant=rest,
            status=Order.Status.DELIVERED,
            created_at__date__gte=last_monday,
            created_at__date__lte=last_sunday
        )
        orders_count = orders.count()
        if orders_count > 0:
            gross = orders.aggregate(total=Sum('subtotal'))['total'] or 0.00
            gross = float(gross)
            comm_amount = round(gross * (default_comm_rate / 100.0), 2)
            net = round(gross - comm_amount, 2)

            VendorPayout.objects.update_or_create(
                cycle=cycle,
                restaurant=rest,
                defaults={
                    'orders_count': orders_count,
                    'gross_sales': gross,
                    'commission_rate': default_comm_rate,
                    'commission_amount': comm_amount,
                    'net_payout': net,
                    'status': VendorPayout.Status.DRAFT
                }
            )
            vendor_payouts_count += 1

    # 2. Generate Driver Payouts
    drivers = User.objects.filter(role=User.Roles.DRIVER)
    driver_payouts_count = 0

    for driver in drivers:
        trips = DeliveryTrip.objects.filter(
            driver=driver,
            status=DeliveryTrip.Status.COMPLETED,
            completed_at__date__gte=last_monday,
            completed_at__date__lte=last_sunday
        )
        trips_count = trips.count()
        if trips_count > 0:
            earned = trips.aggregate(total=Sum('driver_earnings'))['total'] or 0.00
            earned = float(earned)
            
            # Sum COD collected from COD orders
            cod_orders = trips.filter(order__payment_method=Order.PaymentMethod.COD)
            cod_collected = cod_orders.aggregate(total=Sum('order__total_amount'))['total'] or 0.00
            cod_collected = float(cod_collected)

            net_balance = round(earned - cod_collected, 2)
            payout_status = DriverPayout.Status.SETTLED if net_balance >= 0 else DriverPayout.Status.DEBT_OWED

            DriverPayout.objects.update_or_create(
                cycle=cycle,
                driver=driver,
                defaults={
                    'trips_count': trips_count,
                    'delivery_fees_earned': earned,
                    'cod_cash_collected': cod_collected,
                    'net_balance': net_balance,
                    'status': payout_status
                }
            )
            driver_payouts_count += 1

    logger.info(f"Weekly payouts generated for {cycle_code}: {vendor_payouts_count} vendors, {driver_payouts_count} drivers.")
    return {
        'cycle_code': cycle_code,
        'vendors_count': vendor_payouts_count,
        'drivers_count': driver_payouts_count
    }
