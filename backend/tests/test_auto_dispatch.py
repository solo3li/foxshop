import pytest
from unittest.mock import patch
from apps.accounts.models import User
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip
from apps.deliveries.dispatch import (
    find_candidate_driver,
    offer_trip_to_driver,
    handle_driver_timeout_or_rejection,
    MAX_DISPATCH_ATTEMPTS
)
from apps.deliveries.tasks import task_schedule_order_dispatch

@pytest.mark.django_db
def test_candidate_driver_search(restaurant, driver_user, customer_address):
    order = Order.objects.create(
        customer=restaurant.owner,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=50.00,
        delivery_fee=15.00,
        total_amount=65.00,
        currency='SAR'
    )
    trip = DeliveryTrip.objects.create(
        order=order,
        driver_earnings=15.00
    )

    candidate, dist = find_candidate_driver(trip)
    assert candidate is not None
    assert candidate == driver_user

@pytest.mark.django_db
def test_dispatch_offer_and_rejection_cascade(restaurant, driver_user, customer_address, api_client):
    order = Order.objects.create(
        customer=restaurant.owner,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=50.00,
        delivery_fee=15.00,
        total_amount=65.00,
        currency='SAR'
    )
    trip = DeliveryTrip.objects.create(
        order=order,
        driver_earnings=15.00,
        status=DeliveryTrip.Status.DISPATCHING
    )

    with patch('apps.deliveries.dispatch.publish_centrifugo_event') as mock_publish:
        offered = offer_trip_to_driver(trip, driver_user, 1)
        assert offered is True
        trip.refresh_from_db()
        assert trip.dispatch_attempts == 1
        assert trip.last_offered_to == driver_user
        assert mock_publish.called

    # Driver rejects trip via API
    api_client.force_authenticate(user=driver_user)
    with patch('apps.deliveries.dispatch.handle_driver_timeout_or_rejection') as mock_handle:
        res = api_client.post(f'/api/v1/driver/deliveries/trips/{trip.id}/reject/', {'reason': 'BUSY'})
        assert res.status_code == 200
        assert mock_handle.called

@pytest.mark.django_db
def test_max_dispatch_attempts_alerts_operations(restaurant, driver_user, customer_address):
    order = Order.objects.create(
        customer=restaurant.owner,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=50.00,
        delivery_fee=15.00,
        total_amount=65.00,
        currency='SAR'
    )
    trip = DeliveryTrip.objects.create(
        order=order,
        driver_earnings=15.00,
        status=DeliveryTrip.Status.DISPATCHING,
        dispatch_attempts=MAX_DISPATCH_ATTEMPTS
    )

    with patch('apps.deliveries.dispatch.publish_centrifugo_event') as mock_publish:
        handle_driver_timeout_or_rejection(trip.id, driver_user.id)
        trip.refresh_from_db()
        assert trip.status == DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED
        assert mock_publish.called

@pytest.mark.django_db
def test_schedule_dispatch_task(restaurant, customer_address):
    restaurant.estimated_prep_time_minutes = 20
    restaurant.save()

    order = Order.objects.create(
        customer=restaurant.owner,
        restaurant=restaurant,
        delivery_address=customer_address,
        subtotal=50.00,
        delivery_fee=15.00,
        total_amount=65.00,
        currency='SAR',
        prep_time_minutes=20,
        status=Order.Status.CONFIRMED
    )

    with patch('apps.deliveries.tasks.task_start_auto_dispatch.apply_async') as mock_apply:
        task_schedule_order_dispatch(str(order.id))
        assert mock_apply.called
        call_kwargs = mock_apply.call_args[1]
        assert call_kwargs.get('countdown') == 15 * 60
