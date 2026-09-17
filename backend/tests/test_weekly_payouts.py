import pytest
from datetime import timedelta
from django.utils import timezone
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip
from apps.payments.models import PayoutCycle, VendorPayout, DriverPayout
from apps.payments.tasks import generate_weekly_payouts
from apps.accounts.models import PlatformSetting

@pytest.mark.django_db
def test_generate_weekly_payouts(restaurant, customer_user, driver_user, customer_address):
    PlatformSetting.objects.update_or_create(
        id=1,
        defaults={'platform_commission_percent': 15.00}
    )

    today = timezone.now().date()
    target_date = timezone.now() - timedelta(days=today.weekday() + 5) # Inside last week

    # 1. Create a delivered order in that cycle
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=200.00,
        delivery_fee=20.00,
        total_amount=220.00,
        currency='SAR',
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.COD
    )
    Order.objects.filter(id=order.id).update(created_at=target_date)

    trip = DeliveryTrip.objects.create(
        order=order,
        driver=driver_user,
        driver_earnings=20.00,
        status=DeliveryTrip.Status.COMPLETED,
        completed_at=target_date
    )
    DeliveryTrip.objects.filter(id=trip.id).update(completed_at=target_date)

    # Run weekly task
    stats = generate_weekly_payouts()
    assert stats['vendors_count'] >= 1
    assert stats['drivers_count'] >= 1

    # Check vendor payout calculation
    vendor_payout = VendorPayout.objects.get(restaurant=restaurant)
    assert float(vendor_payout.gross_sales) == 200.00
    assert float(vendor_payout.commission_rate) == 15.00
    assert float(vendor_payout.commission_amount) == 30.00 # 15% of 200
    assert float(vendor_payout.net_payout) == 170.00 # 200 - 30

    # Check driver payout calculation
    driver_payout = DriverPayout.objects.get(driver=driver_user)
    assert float(driver_payout.delivery_fees_earned) == 20.00
    assert float(driver_payout.cod_cash_collected) == 220.00
    # Net balance: 20 - 220 = -200 (Driver owes money to platform)
    assert float(driver_payout.net_balance) == -200.00
    assert driver_payout.status == DriverPayout.Status.DEBT_OWED
