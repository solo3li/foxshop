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
    user = User.objects.get(username='newuser')
    assert user.role == User.Roles.CUSTOMER

@pytest.mark.django_db
def test_register_with_admin_role_escalation_attempt(api_client):
    """
    M1.1: Ensure attempting to register with role='ADMIN' in payload
    is stripped/ignored and user is strictly assigned CUSTOMER role.
    """
    payload = {
        'username': 'hackadmin',
        'password': 'strongpassword123',
        'first_name': 'هاكر',
        'last_name': 'مجهول',
        'phone_number': '+966555999001',
        'role': 'ADMIN'
    }
    response = api_client.post('/api/v1/auth/register/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['user']['role'] == 'CUSTOMER'
    user = User.objects.get(username='hackadmin')
    assert user.role == User.Roles.CUSTOMER
    assert user.is_staff is False
    assert user.is_superuser is False

@pytest.mark.django_db
def test_register_with_ops_manager_role_escalation_attempt(api_client):
    """
    M1.1: Ensure attempting to register with role='OPS_MANAGER' in payload
    is stripped/ignored and user is strictly assigned CUSTOMER role.
    """
    payload = {
        'username': 'hackops',
        'password': 'strongpassword123',
        'first_name': 'هاكر',
        'last_name': 'عمليات',
        'phone_number': '+966555999002',
        'role': 'OPS_MANAGER'
    }
    response = api_client.post('/api/v1/auth/register/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['user']['role'] == 'CUSTOMER'
    user = User.objects.get(username='hackops')
    assert user.role == User.Roles.CUSTOMER

@pytest.mark.django_db
def test_register_without_role_defaults_to_customer(api_client):
    """
    M1.1: Ensure public registration without supplying role field
    defaults strictly to CUSTOMER role.
    """
    payload = {
        'username': 'noroleuser',
        'password': 'strongpassword123',
        'first_name': 'عميل',
        'last_name': 'طبيعي',
        'phone_number': '+966555999003'
    }
    response = api_client.post('/api/v1/auth/register/', payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['user']['role'] == 'CUSTOMER'
    user = User.objects.get(username='noroleuser')
    assert user.role == User.Roles.CUSTOMER

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
