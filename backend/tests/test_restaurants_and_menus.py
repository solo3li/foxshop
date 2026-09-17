import pytest
from rest_framework import status
from apps.menus.models import MenuItem

@pytest.mark.django_db
def test_customer_list_restaurants_with_geolocation(api_client, restaurant):
    # Customer near the restaurant (Riyadh)
    response = api_client.get('/api/v1/customer/restaurants/?lat=24.7140&lng=46.6755')
    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]['name'] == 'بيتزا فوكس'
    assert response.data[0]['currency'] == 'SAR'
    assert 'distance_km' in response.data[0]

@pytest.mark.django_db
def test_customer_menu_categories_and_items(api_client, restaurant, menu_item):
    response = api_client.get(f'/api/v1/customer/menus/restaurant/{restaurant.id}/')
    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) >= 1
    assert response.data[0]['name'] == 'بيتزا مميزة'
    items = response.data[0]['items']
    assert len(items) == 1
    assert items[0]['name'] == 'مارجريتا سوبريم'
    assert len(items[0]['modifier_groups']) == 1
    assert len(items[0]['modifier_groups'][0]['modifiers']) == 2

@pytest.mark.django_db
def test_merchant_item_86_toggle(api_client, merchant_user, menu_item):
    api_client.force_authenticate(user=merchant_user)
    
    # Toggle availability to False (86'ed)
    url = f'/api/v1/merchant/menus/items/{menu_item.id}/toggle-availability/'
    response = api_client.post(url)
    assert response.status_code == status.HTTP_200_OK
    assert response.data['is_available'] is False
    
    menu_item.refresh_from_db()
    assert menu_item.is_available is False
