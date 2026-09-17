import pytest
from rest_framework import status
from apps.orders.models import Order
from apps.deliveries.models import DeliveryTrip
from apps.deliveries.services import create_and_dispatch_trip

@pytest.mark.django_db
def test_driver_delivery_flow_and_otp_completion(api_client, customer_user, driver_user, restaurant, menu_item, customer_address):
    # 1. Place order
    api_client.force_authenticate(user=customer_user)
    payload = {
        'restaurant_id': str(restaurant.id),
        'delivery_address_id': str(customer_address.id),
        'payment_method': 'COD',
        'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
    }
    order_res = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    order = Order.objects.get(id=order_res.data['id'])

    # 2. Dispatch trip to driver
    trip = create_and_dispatch_trip(order)
    assert trip.driver == driver_user
    assert trip.status == DeliveryTrip.Status.OFFERED
    otp = trip.delivery_otp
    assert len(otp) == 4

    # 3. Driver accepts trip
    api_client.force_authenticate(user=driver_user)
    accept_res = api_client.post(f'/api/v1/driver/deliveries/trips/{trip.id}/accept/')
    assert accept_res.status_code == status.HTTP_200_OK
    assert accept_res.data['trip']['status'] == DeliveryTrip.Status.ACCEPTED

    # 4. Driver picks up order from restaurant
    pickup_res = api_client.post(f'/api/v1/driver/deliveries/trips/{trip.id}/pickup/')
    assert pickup_res.status_code == status.HTTP_200_OK
    assert pickup_res.data['trip']['status'] == DeliveryTrip.Status.PICKED_UP
    order.refresh_from_db()
    assert order.status == Order.Status.ON_THE_WAY

    # 5. Invalid OTP attempt
    otp_fail_res = api_client.post(f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/', {'otp': '0000'}, format='json')
    assert otp_fail_res.status_code == status.HTTP_400_BAD_REQUEST

    # 6. Correct OTP completion
    otp_success_res = api_client.post(f'/api/v1/driver/deliveries/trips/{trip.id}/verify-otp/', {'otp': otp}, format='json')
    assert otp_success_res.status_code == status.HTTP_200_OK
    assert otp_success_res.data['trip']['status'] == DeliveryTrip.Status.COMPLETED

    order.refresh_from_db()
    assert order.status == Order.Status.DELIVERED
    
    # Driver cash accumulation check (since COD)
    driver_user.driver_profile.refresh_from_db()
    assert driver_user.driver_profile.cash_in_hand == order.total_amount
    assert driver_user.driver_profile.total_delivered_orders == 1
