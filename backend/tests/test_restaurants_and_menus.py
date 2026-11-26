import pytest
from rest_framework import status
from apps.menus.models import MenuItem
from django.core.files.uploadedfile import SimpleUploadedFile

@pytest.mark.django_db
def test_customer_list_restaurants_with_geolocation(api_client, restaurant):
    # Customer near the restaurant (Riyadh)
    response = api_client.get('/api/v1/customer/restaurants/?lat=24.7140&lng=46.6755')
    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]['name'] == 'بيتزا فوكس'
    assert response.data[0]['currency'] == 'EGP'
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


@pytest.mark.django_db
def test_merchant_menu_item_image_upload_and_creation(api_client, merchant_user, menu_item):
    api_client.force_authenticate(user=merchant_user)
    category = menu_item.category

    # Valid 1x1 GIF image bytes
    valid_gif_bytes = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'

    # 1. Test dedicated upload endpoint
    fake_image = SimpleUploadedFile(
        name='delicious_pizza.gif',
        content=valid_gif_bytes,
        content_type='image/gif'
    )
    upload_res = api_client.post(
        '/api/v1/merchant/menus/items/upload-image/',
        {'image': fake_image},
        format='multipart'
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    assert 'url' in upload_res.data
    assert 'delicious_pizza' in upload_res.data['url']
    uploaded_url = upload_res.data['url']

    # 2. Test creating menu item with the uploaded image URL string
    create_res = api_client.post(
        '/api/v1/merchant/menus/items/',
        {
            'category': str(category.id),
            'name': 'بيتزا باربيكيو',
            'base_price': '45.00',
            'image': uploaded_url,
            'is_available': True,
        },
        format='json'
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    assert create_res.data['name'] == 'بيتزا باربيكيو'
    assert 'delicious_pizza' in create_res.data['image']

    # 3. Test creating menu item directly via multipart form-data with image file
    direct_image = SimpleUploadedFile(
        name='burger_deluxe.gif',
        content=valid_gif_bytes,
        content_type='image/gif'
    )
    direct_res = api_client.post(
        '/api/v1/merchant/menus/items/',
        {
            'category': str(category.id),
            'name': 'برجر ديلوكس لحم',
            'base_price': '55.00',
            'image': direct_image,
            'is_available': True,
        },
        format='multipart'
    )
    assert direct_res.status_code == status.HTTP_201_CREATED
    assert direct_res.data['name'] == 'برجر ديلوكس لحم'
    assert 'burger_deluxe' in direct_res.data['image']

