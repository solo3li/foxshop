import pytest
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip
from apps.reviews.models import OrderReview

@pytest.mark.django_db
def test_order_review_cannot_be_created_before_delivery(customer_user, restaurant, customer_address, api_client):
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=80.00,
        delivery_fee=15.00,
        total_amount=95.00,
        currency='SAR',
        status=Order.Status.CONFIRMED
    )

    api_client.force_authenticate(user=customer_user)
    payload = {
        'food_rating': 5,
        'restaurant_comment': 'وجبة رائعة'
    }
    res = api_client.post(f'/api/v1/reviews/customer/orders/{order.id}/review/', payload)
    assert res.status_code == 400
    assert 'لا يمكن تقييم الطلب إلا بعد استلامه بنجاح' in str(res.data)

@pytest.mark.django_db
def test_order_review_creation_and_rating_aggregates(customer_user, merchant_user, driver_user, restaurant, customer_address, api_client):
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=80.00,
        delivery_fee=15.00,
        total_amount=95.00,
        currency='SAR',
        status=Order.Status.DELIVERED
    )
    trip = DeliveryTrip.objects.create(
        order=order,
        driver=driver_user,
        status=DeliveryTrip.Status.COMPLETED
    )

    api_client.force_authenticate(user=customer_user)
    payload = {
        'food_rating': 4,
        'packaging_rating': 5,
        'restaurant_comment': 'الأكل لذيذ جداً والتغليف ممتاز',
        'delivery_speed_rating': 5,
        'driver_rating': 5,
        'driver_comment': 'كابتن خلوق وسريع'
    }
    res = api_client.post(f'/api/v1/reviews/customer/orders/{order.id}/review/', payload)
    assert res.status_code == 201
    
    # Verify aggregate star rating updated on restaurant
    restaurant.refresh_from_db()
    assert restaurant.rating == 4.5

    # Verify aggregate star rating updated on driver profile
    driver_profile = driver_user.driver_profile
    driver_profile.refresh_from_db()
    assert driver_profile.rating == 5.0

    # Test duplicate review rejected
    res_dup = api_client.post(f'/api/v1/reviews/customer/orders/{order.id}/review/', payload)
    assert res_dup.status_code == 400

@pytest.mark.django_db
def test_merchant_reply_to_review(customer_user, merchant_user, restaurant, customer_address, api_client):
    order = Order.objects.create(
        customer=customer_user,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=80.00,
        delivery_fee=15.00,
        total_amount=95.00,
        currency='SAR',
        status=Order.Status.DELIVERED
    )
    review = OrderReview.objects.create(
        order=order,
        restaurant=restaurant,
        customer=customer_user,
        food_rating=5,
        packaging_rating=5,
        restaurant_comment='ممتاز جداً'
    )

    api_client.force_authenticate(user=merchant_user)
    res = api_client.post(f'/api/v1/reviews/merchant/reviews/{review.id}/reply/', {
        'reply': 'شكراً جزيلاً لتقييمك، نسعد بخدمتكم دائماً!'
    })
    assert res.status_code == 200
    review.refresh_from_db()
    assert review.merchant_reply is not None
    assert 'شكراً جزيلاً' in review.merchant_reply
