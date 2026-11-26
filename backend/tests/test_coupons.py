import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from apps.promotions.models import Coupon, CouponUsage
from apps.orders.models import Order
from apps.restaurants.models import Restaurant

@pytest.mark.django_db
def test_coupon_models_and_calculations(sar_currency, merchant_user):
    store = Restaurant.objects.create(
        owner=merchant_user,
        name='برجر فاكتوري',
        currency=sar_currency,
        min_order_amount=20.00,
        delivery_fee=10.00,
        latitude=24.71,
        longitude=46.67
    )

    # 1. Percent coupon with cap
    pct_coupon = Coupon.objects.create(
        code='SAVE50',
        discount_type=Coupon.DiscountTypes.PERCENT,
        discount_value=Decimal('50.00'),
        min_order_amount=Decimal('50.00'),
        max_discount_amount=Decimal('30.00'),
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=5),
        funded_by=Coupon.FundedBy.PLATFORM
    )
    # 50% of 100 = 50, but cap is 30
    assert pct_coupon.calculate_discount(Decimal('100.00')) == Decimal('30.00')
    # Below min order
    assert pct_coupon.calculate_discount(Decimal('40.00')) == Decimal('0.00')

    # 2. Flat coupon
    flat_coupon = Coupon.objects.create(
        code='FLAT15',
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=Decimal('15.00'),
        min_order_amount=Decimal('30.00'),
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=5)
    )
    assert flat_coupon.calculate_discount(Decimal('50.00')) == Decimal('15.00')
    assert flat_coupon.calculate_discount(Decimal('10.00')) == Decimal('0.00') # below min

    # 3. Free delivery coupon
    free_del_coupon = Coupon.objects.create(
        code='FREEDEL',
        discount_type=Coupon.DiscountTypes.FREE_DELIVERY,
        discount_value=Decimal('0.00'),
        min_order_amount=Decimal('40.00'),
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=5)
    )
    assert free_del_coupon.calculate_discount(subtotal=Decimal('60.00'), delivery_fee=Decimal('15.00')) == Decimal('15.00')


@pytest.mark.django_db
def test_coupon_validation_api(api_client, customer_user, restaurant):
    api_client.force_authenticate(user=customer_user)

    # Create Store-specific Coupon
    store_coupon = Coupon.objects.create(
        code='STORE10',
        discount_type=Coupon.DiscountTypes.PERCENT,
        discount_value=Decimal('10.00'),
        min_order_amount=Decimal('20.00'),
        restaurant=restaurant,
        funded_by=Coupon.FundedBy.MERCHANT,
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=10)
    )

    # 1. Successful validation with matching restaurant
    res = api_client.post('/api/v1/customer/promotions/validate/', {
        'code': 'STORE10',
        'subtotal': '100.00',
        'restaurant_id': str(restaurant.id)
    }, format='json')
    assert res.status_code == status.HTTP_200_OK
    assert res.data['valid'] is True
    assert Decimal(str(res.data['discount_amount'])) == Decimal('10.00')

    # 2. Validation fails if different restaurant
    other_restaurant = Restaurant.objects.create(
        owner=restaurant.owner,
        name='شاورما الكينج',
        currency=restaurant.currency,
        min_order_amount=15.00,
        delivery_fee=8.00,
        latitude=24.72,
        longitude=46.68
    )
    res_other = api_client.post('/api/v1/customer/promotions/validate/', {
        'code': 'STORE10',
        'subtotal': '100.00',
        'restaurant_id': str(other_restaurant.id)
    }, format='json')
    assert res_other.status_code == status.HTTP_400_BAD_REQUEST
    assert "خاص بـ" in res_other.data['error']


@pytest.mark.django_db
def test_first_order_only_coupon(api_client, customer_user, restaurant):
    api_client.force_authenticate(user=customer_user)

    coupon = Coupon.objects.create(
        code='WELCOME',
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=Decimal('20.00'),
        min_order_amount=Decimal('30.00'),
        first_order_only=True,
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=10)
    )

    # Valid before any order
    res = api_client.post('/api/v1/customer/promotions/validate/', {
        'code': 'WELCOME',
        'subtotal': '50.00'
    }, format='json')
    assert res.status_code == status.HTTP_200_OK
    assert res.data['valid'] is True

    # Simulate existing delivered order
    Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        status=Order.Status.DELIVERED,
        subtotal=Decimal('50.00'),
        delivery_fee=Decimal('10.00'),
        total_amount=Decimal('60.00')
    )

    # Now it should be rejected
    res2 = api_client.post('/api/v1/customer/promotions/validate/', {
        'code': 'WELCOME',
        'subtotal': '50.00'
    }, format='json')
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "للطلب الأول فقط" in res2.data['error']


@pytest.mark.django_db
def test_order_creation_with_coupon_applies_discount_and_records_usage(api_client, customer_user, restaurant, menu_item, customer_address):
    api_client.force_authenticate(user=customer_user)

    coupon = Coupon.objects.create(
        code='DISCOUNT20',
        discount_type=Coupon.DiscountTypes.PERCENT,
        discount_value=Decimal('20.00'),
        min_order_amount=Decimal('30.00'),
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=10),
        max_usage_per_user=1
    )

    payload = {
        'restaurant_id': str(restaurant.id),
        'delivery_address_id': str(customer_address.id),
        'payment_method': 'COD',
        'customer_notes': 'الرجاء عدم الاتصال بالجرس',
        'coupon_code': 'DISCOUNT20',
        'items': [
            {
                'menu_item_id': str(menu_item.id),
                'quantity': 2,
                'modifier_ids': []
            }
        ]
    }

    res = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    assert res.status_code == status.HTTP_201_CREATED

    order = Order.objects.get(id=res.data['id'])
    assert order.coupon == coupon
    assert order.coupon_code == 'DISCOUNT20'
    assert order.discount_amount > Decimal('0.00')
    # 2 items @ 45 = 90 SAR subtotal. 20% discount = 18 SAR.
    assert order.discount_amount == Decimal('18.00')
    # total = subtotal (90) + delivery_fee - 18
    assert order.total_amount == (order.subtotal + order.delivery_fee - order.discount_amount)

    # Verify CouponUsage record
    usage = CouponUsage.objects.filter(coupon=coupon, user=customer_user, order=order).first()
    assert usage is not None
    assert usage.discount_applied == Decimal('18.00')

    # Trying to reuse the single-use coupon on a second order should fail
    res2 = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "استنفدت" in str(res2.data)


@pytest.mark.django_db
def test_merchant_coupon_api_crud_and_toggle(api_client, merchant_user, restaurant):
    api_client.force_authenticate(user=merchant_user)

    # 1. Create store coupon
    create_payload = {
        'code': 'BURGER25',
        'discount_type': 'PERCENT',
        'discount_value': '25.00',
        'min_order_amount': '50.00',
        'max_discount_amount': '25.00',
        'first_order_only': False,
        'valid_from': (timezone.now() - timedelta(hours=1)).isoformat(),
        'valid_to': (timezone.now() + timedelta(days=30)).isoformat(),
        'max_usage_per_user': 2
    }

    res = api_client.post('/api/v1/merchant/promotions/coupons/', create_payload, format='json')
    assert res.status_code == status.HTTP_201_CREATED
    coupon_id = res.data['id']
    assert res.data['code'] == 'BURGER25'
    assert res.data['funded_by'] == 'MERCHANT'
    assert res.data['restaurant'] == restaurant.id

    # 2. List merchant coupons
    res_list = api_client.get('/api/v1/merchant/promotions/coupons/')
    assert res_list.status_code == status.HTTP_200_OK
    assert len(res_list.data) == 1
    assert res_list.data[0]['code'] == 'BURGER25'

    # 3. Toggle active status
    res_toggle = api_client.post(f'/api/v1/merchant/promotions/coupons/{coupon_id}/toggle/')
    assert res_toggle.status_code == status.HTTP_200_OK
    assert res_toggle.data['is_active'] is False

    # Toggle back
    res_toggle_back = api_client.post(f'/api/v1/merchant/promotions/coupons/{coupon_id}/toggle/')
    assert res_toggle_back.status_code == status.HTTP_200_OK
    assert res_toggle_back.data['is_active'] is True
