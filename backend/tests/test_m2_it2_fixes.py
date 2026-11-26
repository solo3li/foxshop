import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from unittest.mock import patch

import inngest
import pytest
from django.db import connections
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Address, PlatformSetting, User
from apps.deliveries.inngest_functions import (
    delivery_inngest_functions,
    fn_weekly_vendor_payouts_cron,
)
from apps.deliveries.models import DriverCashSettlement, DriverProfile
from apps.menus.models import MenuCategory, MenuItem, Modifier, ModifierGroup
from apps.orders.models import Order, OrderItem, OrderItemModifier
from apps.payments.inngest_functions import fn_weekly_payouts_flow, payment_inngest_functions
from apps.payments.models import Transaction, Wallet
from apps.promotions.models import Coupon
from apps.restaurants.models import Restaurant


@pytest.mark.django_db
def test_confirm_weights_idempotent_second_call_rejected(
    api_client, customer_user, merchant_user, egp_currency, customer_address
):
    store = Restaurant.objects.create(
        owner=merchant_user,
        name='ملحمة الاختبار',
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=10.0,
        delivery_fee=Decimal('10.00'),
    )
    cat = MenuCategory.objects.create(restaurant=store, name='لحوم')
    steak = MenuItem.objects.create(
        category=cat, name='ستيك', base_price=Decimal('100.00'), pricing_unit=MenuItem.PricingUnit.KG
    )
    order = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.CARD,
        payment_status=Order.PaymentStatus.PENDING,
        currency='EGP',
        subtotal=Decimal('100.00'),
        delivery_fee=Decimal('10.00'),
        preauth_hold_amount=Decimal('15.00'),
        total_amount=Decimal('125.00'),
        is_weight_confirmed=False,
    )
    item = OrderItem.objects.create(
        order=order,
        menu_item=steak,
        item_name=steak.name,
        unit_price=Decimal('100.00'),
        quantity=1,
        requested_weight=Decimal('1.000'),
        is_weighted=True,
        total_price=Decimal('100.00'),
    )

    api_client.force_authenticate(user=merchant_user)
    with patch('apps.orders.views.publish_centrifugo_event'):
        r1 = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(item.id), 'actual_weight': '1.100'}]},
            format='json',
        )
        assert r1.status_code == status.HTTP_200_OK

        # Second call attempting to bypass preauth ceiling must be rejected
        r2 = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(item.id), 'actual_weight': '5.000'}]},
            format='json',
        )
        assert r2.status_code == status.HTTP_400_BAD_REQUEST

    order.refresh_from_db()
    assert order.total_amount == Decimal('120.00')


@pytest.mark.django_db
def test_confirm_weights_wallet_extra_delta_debit_and_insufficient_balance(
    api_client, customer_user, merchant_user, egp_currency, customer_address
):
    store = Restaurant.objects.create(
        owner=merchant_user,
        name='أسماك البحر',
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=10.0,
        delivery_fee=Decimal('10.00'),
    )
    cat = MenuCategory.objects.create(restaurant=store, name='أسماك')
    fish = MenuItem.objects.create(
        category=cat, name='سمك', base_price=Decimal('100.00'), pricing_unit=MenuItem.PricingUnit.KG
    )
    wallet = Wallet.objects.create(user=customer_user, currency='EGP', balance=Decimal('25.00'))

    order = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.WALLET,
        payment_status=Order.PaymentStatus.PAID,
        currency='EGP',
        subtotal=Decimal('100.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('110.00'),
    )
    item = OrderItem.objects.create(
        order=order,
        menu_item=fish,
        item_name=fish.name,
        unit_price=Decimal('100.00'),
        quantity=1,
        requested_weight=Decimal('1.000'),
        is_weighted=True,
        total_price=Decimal('100.00'),
    )

    api_client.force_authenticate(user=merchant_user)
    with patch('apps.orders.views.publish_centrifugo_event'):
        # 1.500 kg -> extra 50.00 EGP exceeds wallet balance 25.00 -> 400 and rollback
        r_fail = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(item.id), 'actual_weight': '1.500'}]},
            format='json',
        )
        assert r_fail.status_code == status.HTTP_400_BAD_REQUEST
        order.refresh_from_db()
        item.refresh_from_db()
        wallet.refresh_from_db()
        assert order.is_weight_confirmed is False
        assert order.total_amount == Decimal('110.00')
        assert item.total_price == Decimal('100.00')
        assert wallet.balance == Decimal('25.00')

        # 1.200 kg -> extra 20.00 EGP <= 25.00 -> succeeds and debits 20.00
        r_ok = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(item.id), 'actual_weight': '1.200'}]},
            format='json',
        )
        assert r_ok.status_code == status.HTTP_200_OK

    order.refresh_from_db()
    wallet.refresh_from_db()
    assert order.is_weight_confirmed is True
    assert order.total_amount == Decimal('130.00')
    assert wallet.balance == Decimal('5.00')
    assert Transaction.objects.filter(
        wallet=wallet, transaction_type=Transaction.Types.ORDER_PAYMENT, amount=Decimal('-20.00')
    ).exists()


@pytest.mark.django_db
def test_confirm_weights_zero_kg_ignores_modifier_delta_on_wallet_and_card_and_rejects_nan(
    api_client, customer_user, merchant_user, egp_currency, customer_address
):
    store = Restaurant.objects.create(
        owner=merchant_user,
        name='فواكه وخضار',
        currency=egp_currency,
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=10.0,
        delivery_fee=Decimal('10.00'),
    )
    cat = MenuCategory.objects.create(restaurant=store, name='خضار')
    item_kg = MenuItem.objects.create(
        category=cat, name='طماطم', base_price=Decimal('20.00'), pricing_unit=MenuItem.PricingUnit.KG
    )
    wallet = Wallet.objects.create(user=customer_user, currency='EGP', balance=Decimal('0.00'))

    order = Order.objects.create(
        customer=customer_user,
        restaurant=store,
        delivery_address=customer_address,
        payment_method=Order.PaymentMethod.WALLET,
        payment_status=Order.PaymentStatus.PAID,
        currency='EGP',
        subtotal=Decimal('30.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('40.00'),
    )
    order_item = OrderItem.objects.create(
        order=order,
        menu_item=item_kg,
        item_name=item_kg.name,
        unit_price=Decimal('20.00'),
        quantity=1,
        requested_weight=Decimal('1.000'),
        is_weighted=True,
        total_price=Decimal('30.00'),
    )
    OrderItemModifier.objects.create(
        order_item=order_item, modifier_name='تغليف خاص', price_delta=Decimal('10.00')
    )

    api_client.force_authenticate(user=merchant_user)
    with patch('apps.orders.views.publish_centrifugo_event'):
        r_nan = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(order_item.id), 'actual_weight': 'NaN'}]},
            format='json',
        )
        assert r_nan.status_code == status.HTTP_400_BAD_REQUEST

        r_unmatched = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(uuid.uuid4()), 'actual_weight': '1.000'}]},
            format='json',
        )
        assert r_unmatched.status_code == status.HTTP_400_BAD_REQUEST

        r_zero = api_client.post(
            f'/api/v1/merchant/orders/{order.id}/confirm-weights/',
            {'items': [{'item_id': str(order_item.id), 'actual_weight': '0.000'}]},
            format='json',
        )
        assert r_zero.status_code == status.HTTP_200_OK

    order.refresh_from_db()
    order_item.refresh_from_db()
    wallet.refresh_from_db()
    assert order_item.total_price == Decimal('0.00')
    assert order.subtotal == Decimal('0.00')
    assert order.total_amount == Decimal('10.00')
    assert wallet.balance == Decimal('30.00')


@pytest.mark.django_db
def test_single_monday_weekly_payout_inngest_cron_and_unified_cycle_code():
    all_fns = delivery_inngest_functions + payment_inngest_functions
    cron_payout_fns = []
    for fn in all_fns:
        triggers = getattr(fn, 'triggers', None) or getattr(fn, '_triggers', None) or []
        if not isinstance(triggers, (list, tuple)):
            triggers = [triggers]
        for trig in triggers:
            if isinstance(trig, inngest.TriggerCron) and '0 0 * * 1' in str(getattr(trig, 'cron', '')):
                cron_payout_fns.append(fn.id)

    assert cron_payout_fns == [fn_weekly_payouts_flow.id]

    class _Step:
        def run(self, _id, fn):
            return fn()

    class _Ctx:
        event = type('Evt', (), {'data': {}})()
        step = _Step()

    handler = getattr(fn_weekly_vendor_payouts_cron, '_handler', None) or fn_weekly_vendor_payouts_cron.fn
    res = handler(_Ctx())
    assert '-W' in res['cycle']


@pytest.mark.django_db
def test_merchant_cannot_transition_out_of_terminal_states(
    api_client, customer_user, merchant_user, restaurant, customer_address
):
    wallet = Wallet.objects.create(user=customer_user, currency='EGP', balance=Decimal('100.00'))
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        status=Order.Status.DELIVERED,
        payment_method=Order.PaymentMethod.WALLET,
        payment_status=Order.PaymentStatus.PAID,
        subtotal=Decimal('50.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('60.00'),
    )
    api_client.force_authenticate(user=merchant_user)

    res = api_client.post(
        f'/api/v1/merchant/orders/{order.id}/status/',
        {'status': Order.Status.CANCELLED, 'reason': 'late'},
        format='json',
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    order.refresh_from_db()
    wallet.refresh_from_db()
    assert order.status == Order.Status.DELIVERED
    assert order.payment_status == Order.PaymentStatus.PAID
    assert wallet.balance == Decimal('100.00')


@pytest.mark.django_db
def test_checkout_validates_requested_weight_and_negative_wallet_on_zero_total(
    api_client, customer_user, restaurant, customer_address
):
    cat = MenuCategory.objects.create(restaurant=restaurant, name='لحوم')
    weighted = MenuItem.objects.create(
        category=cat, name='كفتة', base_price=Decimal('100.00'), pricing_unit=MenuItem.PricingUnit.KG
    )
    fixed = MenuItem.objects.create(
        category=cat, name='سلطة', base_price=Decimal('30.00'), pricing_unit=MenuItem.PricingUnit.PIECE
    )
    Wallet.objects.create(user=customer_user, currency='EGP', balance=Decimal('-5.00'))
    now = timezone.now()
    Coupon.objects.create(
        code='FREEZERO',
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=Decimal('50.00'),
        min_order_amount=Decimal('0.00'),
        valid_from=now - timezone.timedelta(days=1),
        valid_to=now + timezone.timedelta(days=1),
        is_active=True,
    )

    api_client.force_authenticate(user=customer_user)

    # Zero requested_weight must fail validation
    r_zero_w = api_client.post(
        '/api/v1/customer/orders/checkout/',
        {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.COD,
            'items': [{'menu_item_id': str(weighted.id), 'quantity': 1, 'requested_weight': '0.000'}],
        },
        format='json',
    )
    assert r_zero_w.status_code == status.HTTP_400_BAD_REQUEST

    # Negative wallet balance must fail even when total_amount == 0.00 after coupon
    r_neg_wallet = api_client.post(
        '/api/v1/customer/orders/checkout/',
        {
            'restaurant_id': str(restaurant.id),
            'delivery_address_id': str(customer_address.id),
            'payment_method': Order.PaymentMethod.WALLET,
            'coupon_code': 'FREEZERO',
            'items': [{'menu_item_id': str(fixed.id), 'quantity': 1}],
        },
        format='json',
    )
    assert r_neg_wallet.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_ops_approval_permission_hardening_and_nan_rejection(driver_user):
    sup = User.objects.create_user(
        username='sup_perm_test', password='pw', role=User.Roles.SUPERVISOR, is_staff=True
    )
    ops_self = User.objects.create_user(
        username='ops_self_test', password='pw', role=User.Roles.OPS_MANAGER, is_staff=True
    )
    ops_other = User.objects.create_user(
        username='ops_other_test', password='pw', role=User.Roles.OPS_MANAGER, is_staff=True
    )

    # 1. Supervisor with is_staff=True must be forbidden from ops approvals
    settlement = DriverCashSettlement.objects.create(
        driver=driver_user,
        supervisor=ops_self,
        amount=Decimal('200.00'),
        balance_before=Decimal('500.00'),
        balance_after=Decimal('300.00'),
        status=DriverCashSettlement.Status.PENDING_APPROVAL,
    )
    c_sup = APIClient()
    c_sup.force_authenticate(user=sup)
    assert c_sup.get('/api/v1/supervisor/ops/approvals/').status_code == status.HTTP_403_FORBIDDEN

    # 2. Ops manager cannot approve their own settlement
    c_self = APIClient()
    c_self.force_authenticate(user=ops_self)
    r_self = c_self.post(f'/api/v1/supervisor/ops/approvals/{settlement.id}/', {'action': 'approve'}, format='json')
    assert r_self.status_code == status.HTTP_403_FORBIDDEN

    # 3. Different ops manager can approve
    c_other = APIClient()
    c_other.force_authenticate(user=ops_other)
    r_other = c_other.post(f'/api/v1/supervisor/ops/approvals/{settlement.id}/', {'action': 'approve'}, format='json')
    assert r_other.status_code == status.HTTP_200_OK

    # 4. NaN rejected with 400 across driver wallet & supervisor settlement endpoints
    c_drv = APIClient()
    c_drv.force_authenticate(user=driver_user)
    assert c_drv.post('/api/v1/driver/wallet/payout-request/', {'amount': 'NaN', 'note': 'x'}, format='json').status_code == 400
    assert c_drv.post('/api/v1/driver/wallet/cash-deposit/', {'amount': 'Infinity', 'reference_number': 'R1'}, format='json').status_code == 400
    assert c_sup.post('/api/v1/supervisor/cash/settle/', {'driver_id': str(driver_user.id), 'amount': 'NaN'}, format='json').status_code == 400


@pytest.mark.django_db(transaction=True)
def test_supervisor_concurrent_multi_driver_settlements_enforce_daily_cap():
    PlatformSetting.objects.update_or_create(id=1, defaults={'supervisor_max_settlement_limit': Decimal('500.00')})
    sup = User.objects.create_user(
        username=f'sup_conc_{uuid.uuid4().hex[:6]}',
        password='pw',
        role=User.Roles.SUPERVISOR,
        is_staff=True,
    )
    d1 = User.objects.create_user(username=f'd1_{uuid.uuid4().hex[:6]}', password='pw', role=User.Roles.DRIVER)
    d2 = User.objects.create_user(username=f'd2_{uuid.uuid4().hex[:6]}', password='pw', role=User.Roles.DRIVER)
    DriverProfile.objects.create(user=d1, cash_in_hand=Decimal('500.00'))
    DriverProfile.objects.create(user=d2, cash_in_hand=Decimal('500.00'))

    barrier = threading.Barrier(2)
    statuses = []

    def _settle(drv_id):
        try:
            c = APIClient()
            c.force_authenticate(user=sup)
            barrier.wait(timeout=5)
            r = c.post('/api/v1/supervisor/cash/settle/', {'driver_id': str(drv_id), 'amount': '300.00'}, format='json')
            statuses.append(r.data.get('status'))
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(_settle, d1.id)
        f2 = pool.submit(_settle, d2.id)
        f1.result()
        f2.result()

    assert statuses.count('APPROVED') == 1
    assert statuses.count('PENDING_APPROVAL') == 1
