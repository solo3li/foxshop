import pytest
from rest_framework import status
from apps.accounts.models import User, Address

@pytest.mark.django_db
def test_user_registration(api_client):
    payload = {
        'username': 'newuser',
        'password': 'strongpassword123',
        'first_name': 'محمد',
        'last_name': 'خالد',
        'phone_number': '+966555123456',
        'role': 'CUSTOMER'
    }
    response = api_client.post('/api/v1/auth/register/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert 'access' in response.data
    assert 'refresh' in response.data
    assert response.data['user']['username'] == 'newuser'
    assert response.data['user']['role'] == 'CUSTOMER'

@pytest.mark.django_db
def test_user_login_success(api_client, customer_user):
    payload = {
        'username': customer_user.username,
        'password': 'password123'
    }
    response = api_client.post('/api/v1/auth/login/', payload, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert 'access' in response.data
    assert response.data['user']['role'] == 'CUSTOMER'

@pytest.mark.django_db
def test_user_login_invalid_credentials(api_client, customer_user):
    payload = {
        'username': customer_user.username,
        'password': 'wrongpassword'
    }
    response = api_client.post('/api/v1/auth/login/', payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.django_db
def test_customer_address_management(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)
    
    payload = {
        'title': 'العمل',
        'street': 'طريق الملك عبدالله',
        'building_number': '4',
        'latitude': 24.720000,
        'longitude': 46.680000,
        'is_default': True
    }
    response = api_client.post('/api/v1/auth/addresses/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['title'] == 'العمل'
    
    # Check address exists in database
    address = Address.objects.get(id=response.data['id'])
    assert address.user == customer_user
    assert address.is_default is True
