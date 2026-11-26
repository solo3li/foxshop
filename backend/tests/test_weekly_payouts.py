import pytest
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip, ShiftSettlement
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
    target_date = timezone.now() - timedelta(days=today.weekday() + 5)  # Inside last week

    # 1. Create a delivered COD order in that cycle
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

    # Check vendor payout calculation:
    # COD sales are excluded from platform disbursement; merchant owes 15% commission on 200.00 = 30.00
    vendor_payout = VendorPayout.objects.get(restaurant=restaurant)
    assert Decimal(str(vendor_payout.gross_sales)) == Decimal('0.00')
    assert Decimal(str(vendor_payout.commission_rate)) == Decimal('15.00')
    assert Decimal(str(vendor_payout.commission_amount)) == Decimal('30.00')  # 15% of 200
    assert Decimal(str(vendor_payout.net_payout)) == Decimal('-30.00')  # Merchant owes platform 30.00

    # Check driver payout calculation (unsettled COD collected = 220.00)
    driver_payout = DriverPayout.objects.get(driver=driver_user)
    assert Decimal(str(driver_payout.delivery_fees_earned)) == Decimal('20.00')
    assert Decimal(str(driver_payout.cod_cash_collected)) == Decimal('220.00')
    # Net balance: 20 - 220 = -200 (Driver owes money to platform)
    assert Decimal(str(driver_payout.net_balance)) == Decimal('-200.00')
    assert driver_payout.status == DriverPayout.Status.DEBT_OWED


@pytest.mark.django_db
def test_generate_weekly_payouts_mixed_electronic_and_settled_cod(
    restaurant, customer_user, driver_user, customer_address
):
    PlatformSetting.objects.update_or_create(
        id=1,
        defaults={'platform_commission_percent': 15.00}
    )

    today = timezone.now().date()
    target_date = timezone.now() - timedelta(days=today.weekday() + 5)

    # Electronic CARD order (subtotal 400.00) + COD order (subtotal 200.00, total 220.00)
    card_order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=Decimal('400.00'),
        delivery_fee=Decimal('20.00'),
        total_amount=Decimal('420.00'),
        currency='EGP',
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.CARD,
        payment_status=Order.PaymentStatus.PAID,
    )
    Order.objects.filter(id=card_order.id).update(created_at=target_date)

    cod_order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=Decimal('200.00'),
        delivery_fee=Decimal('20.00'),
        total_amount=Decimal('220.00'),
        currency='EGP',
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.COD,
        is_settled_with_merchant=True,
    )
    Order.objects.filter(id=cod_order.id).update(created_at=target_date)

    trip = DeliveryTrip.objects.create(
        order=cod_order,
        driver=driver_user,
        driver_earnings=Decimal('20.00'),
        status=DeliveryTrip.Status.COMPLETED,
    )
    DeliveryTrip.objects.filter(id=trip.id).update(completed_at=target_date)

    settlement = ShiftSettlement.objects.create(
        restaurant=restaurant,
        driver=driver_user,
        orders_count=1,
        total_goods_amount=Decimal('200.00'),
        platform_commission_amount=Decimal('30.00'),
        status=ShiftSettlement.Status.COMPLETED,
        settled_at=target_date,
    )
    settlement.orders.add(cod_order)

    generate_weekly_payouts()

    # Vendor: electronic_gross = 400.00, commission on all (400+200)*15% = 90.00, net_payout = 310.00
    vp = VendorPayout.objects.get(restaurant=restaurant)
    assert vp.gross_sales == Decimal('400.00')
    assert vp.commission_amount == Decimal('90.00')
    assert vp.net_payout == Decimal('310.00')

    # Driver: COD order was settled via ShiftSettlement -> cod_cash_collected = 0.00, net_balance = 20.00
    dp = DriverPayout.objects.get(driver=driver_user)
    assert dp.cod_cash_collected == Decimal('0.00')
    assert dp.net_balance == Decimal('20.00')
    assert dp.status == DriverPayout.Status.SETTLED
