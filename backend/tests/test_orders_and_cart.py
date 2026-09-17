import pytest
from rest_framework import status
from apps.orders.models import Order
from apps.restaurants.models import Restaurant
from apps.menus.models import MenuCategory, MenuItem

@pytest.mark.django_db
def test_order_creation_success(api_client, customer_user, restaurant, menu_item, customer_address):
    api_client.force_authenticate(user=customer_user)
    modifier = menu_item.modifier_groups.first().modifiers.get(name='كبير L')

    payload = {
        'restaurant_id': str(restaurant.id),
        'delivery_address_id': str(customer_address.id),
        'payment_method': 'COD',
        'customer_notes': 'يرجى عدم رن الجرس',
        'items': [
            {
                'menu_item_id': str(menu_item.id),
                'quantity': 2,
                'modifier_ids': [str(modifier.id)]
            }
        ]
    }
    # Base price: 45 + 10 (modifier) = 55 * 2 = 110. Delivery fee: 12 -> Total: 122.00
    response = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['order_number'].startswith('FOX-')
    assert float(response.data['subtotal']) == 110.0
    assert float(response.data['delivery_fee']) == 12.0
    assert float(response.data['total_amount']) == 122.0
    assert response.data['currency'] == 'SAR'
    assert response.data['status'] == 'PENDING'

    order = Order.objects.get(id=response.data['id'])
    assert order.items.count() == 1
    assert order.items.first().modifiers.count() == 1

@pytest.mark.django_db
def test_single_vendor_cart_rejection(api_client, customer_user, restaurant, menu_item, customer_address, merchant_user):
    api_client.force_authenticate(user=customer_user)

    # Create a 2nd restaurant with its own item
    other_rest = Restaurant.objects.create(
        owner=merchant_user,
        name='برجر ثعلب',
        address_text='شارع التحلية',
        latitude=24.7136,
        longitude=46.6753,
        delivery_radius_km=10.0
    )
    cat2 = MenuCategory.objects.create(restaurant=other_rest, name='برجر')
    item2 = MenuItem.objects.create(category=cat2, name='تشيز برجر', base_price=30.0)

    payload = {
        'restaurant_id': str(restaurant.id),
        'delivery_address_id': str(customer_address.id),
        'items': [
            {'menu_item_id': str(menu_item.id), 'quantity': 1},
            {'menu_item_id': str(item2.id), 'quantity': 1} # From different restaurant!
        ]
    }
    response = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "لا يمكن طلب وجبات من مطاعم مختلفة" in str(response.data)

@pytest.mark.django_db
def test_merchant_order_status_transition(api_client, customer_user, merchant_user, restaurant, menu_item, customer_address):
    # 1. Customer creates order
    api_client.force_authenticate(user=customer_user)
    payload = {
        'restaurant_id': str(restaurant.id),
        'delivery_address_id': str(customer_address.id),
        'items': [{'menu_item_id': str(menu_item.id), 'quantity': 1}]
    }
    create_res = api_client.post('/api/v1/customer/orders/checkout/', payload, format='json')
    order_id = create_res.data['id']

    # 2. Merchant accepts and updates to PREPARING
    api_client.force_authenticate(user=merchant_user)
    status_payload = {
        'status': 'PREPARING',
        'prep_time_minutes': 30
    }
    status_res = api_client.post(f'/api/v1/merchant/orders/{order_id}/status/', status_payload, format='json')
    assert status_res.status_code == status.HTTP_200_OK
    assert status_res.data['order']['status'] == 'PREPARING'
    assert status_res.data['order']['prep_time_minutes'] == 30
