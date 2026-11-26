import logging
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum
from apps.payments.models import PayoutCycle, VendorPayout, DriverPayout
from apps.restaurants.models import Restaurant
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip, DriverCashSettlement, ShiftSettlement
from apps.accounts.models import PlatformSetting, User

logger = logging.getLogger(__name__)


def execute_weekly_payouts(start_date, end_date, cycle_code):
    """
    Calculate and persist weekly vendor and driver payouts for [start_date, end_date].
    - Vendors: Net payout = electronic sales (CARD, WALLET) minus platform commission on ALL orders (electronic + COD).
      COD cash collected by vendor is excluded from platform disbursement.
    - Drivers: Driver earnings minus unsettled COD cash (excluding orders settled with merchant or approved DriverCashSettlement).
    """
    cycle, _ = PayoutCycle.objects.get_or_create(
        cycle_code=cycle_code,
        defaults={
            'start_date': start_date,
            'end_date': end_date,
            'is_closed': False
        }
    )
    if cycle.is_closed:
        return {
            'cycle_code': cycle_code,
            'status': 'already_closed',
            'vendors_count': 0,
            'drivers_count': 0,
        }

    platform_setting = PlatformSetting.get_settings()
    default_comm_rate = Decimal(str(platform_setting.platform_commission_percent))

    # 1. Generate Vendor Payouts
    restaurants = Restaurant.objects.filter(is_active=True)
    vendor_payouts_count = 0

    for rest in restaurants:
        orders = Order.objects.filter(
            restaurant=rest,
            status=Order.Status.DELIVERED,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        orders_count = orders.count()
        if orders_count > 0:
            electronic_gross = orders.filter(
                payment_method__in=[Order.PaymentMethod.CARD, Order.PaymentMethod.WALLET]
            ).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
            electronic_gross = Decimal(str(electronic_gross))

            all_gross = orders.aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
            all_gross = Decimal(str(all_gross))

            comm_amount = round(all_gross * (default_comm_rate / Decimal('100.00')), 2)
            # Exclude COD sales from platform disbursement; merchant owes commission on all orders
            net = round(electronic_gross - comm_amount, 2)

            VendorPayout.objects.update_or_create(
                cycle=cycle,
                restaurant=rest,
                defaults={
                    'orders_count': orders_count,
                    'gross_sales': electronic_gross,
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
            completed_at__date__gte=start_date,
            completed_at__date__lte=end_date
        )
        trips_count = trips.count()
        if trips_count > 0:
            earned = trips.aggregate(total=Sum('driver_earnings'))['total'] or Decimal('0.00')
            earned = Decimal(str(earned))

            # Only deduct COD cash NOT yet settled with merchant via ShiftSettlement
            unsettled_cod_trips = trips.filter(
                order__payment_method=Order.PaymentMethod.COD,
                order__is_settled_with_merchant=False
            ).exclude(
                order__shift_settlements__status=ShiftSettlement.Status.COMPLETED
            )
            unsettled_cod_collected = unsettled_cod_trips.aggregate(
                total=Sum('order__total_amount')
            )['total'] or Decimal('0.00')
            unsettled_cod_collected = Decimal(str(unsettled_cod_collected))

            # Subtract any approved DriverCashSettlement handovers to supervisors during the cycle
            approved_handovers = DriverCashSettlement.objects.filter(
                driver=driver,
                status=DriverCashSettlement.Status.APPROVED,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            approved_handovers = Decimal(str(approved_handovers))

            cod_collected = max(Decimal('0.00'), unsettled_cod_collected - approved_handovers)
            net_balance = round(earned - cod_collected, 2)
            payout_status = DriverPayout.Status.SETTLED if net_balance >= Decimal('0.00') else DriverPayout.Status.DEBT_OWED

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

    logger.info(
        f"Weekly payouts generated for {cycle_code}: "
        f"{vendor_payouts_count} vendors, {driver_payouts_count} drivers."
    )
    return {
        'cycle_code': cycle_code,
        'vendors_count': vendor_payouts_count,
        'drivers_count': driver_payouts_count
    }


def generate_weekly_payouts():
    today = timezone.now().date()
    # Calculate previous Monday to Sunday
    last_monday = today - timedelta(days=today.weekday() + 7)
    last_sunday = last_monday + timedelta(days=6)
    cycle_code = f"WEEK-{last_monday.strftime('%Y-W%W')}"
    return execute_weekly_payouts(last_monday, last_sunday, cycle_code)
