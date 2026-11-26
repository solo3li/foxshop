import pytest
from django.conf import settings
from apps.payments.models import Currency, Wallet
from apps.restaurants.models import Restaurant, DeliveryZone
from apps.orders.models import Order


@pytest.mark.django_db
def test_central_settings_constants():
    assert getattr(settings, 'DEFAULT_CURRENCY', None) == 'EGP'
    assert getattr(settings, 'DEFAULT_CURRENCY_SYMBOL', None) == 'ج.م'


@pytest.mark.django_db
def test_egp_currency_exists_and_is_active(egp_currency):
    currency = Currency.objects.get(code='EGP')
    assert currency.name == 'جنيه مصري'
    assert currency.symbol == 'ج.م'
    assert currency.is_active is True


@pytest.mark.django_db
def test_rogue_eg_currency_not_present(db):
    assert not Currency.objects.filter(code='e.g').exists()


@pytest.mark.django_db
def test_delivery_zone_default_currency(db, egp_currency):
    zone = DeliveryZone.objects.create(
        name='منطقة القاهرة الجديدة',
        city='القاهرة'
    )
    assert zone.currency == egp_currency
    assert zone.currency.code == 'EGP'
    assert zone.currency.symbol == 'ج.م'


@pytest.mark.django_db
def test_restaurant_default_currency(db, merchant_user, egp_currency):
    restaurant = Restaurant.objects.create(
        owner=merchant_user,
        name='كشري التحرير',
        address_text='وسط البلد، القاهرة',
        latitude=30.0444,
        longitude=31.2357
    )
    assert restaurant.currency == egp_currency
    assert restaurant.currency.code == 'EGP'
    assert restaurant.currency.symbol == 'ج.م'


@pytest.mark.django_db
def test_order_default_currency(db, customer_user, restaurant):
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        order_number='FOX-TEST-001',
        subtotal=100.00,
        delivery_fee=15.00,
        total_amount=115.00
    )
    assert order.currency == 'EGP'


@pytest.mark.django_db
def test_wallet_default_currency(db, customer_user):
    wallet = Wallet.objects.create(
        user=customer_user,
        balance=50.00
    )
    assert wallet.currency == 'EGP'
    assert f"({wallet.balance} EGP)" in str(wallet)
