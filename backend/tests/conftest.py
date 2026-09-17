import pytest
from rest_framework.test import APIClient
from apps.accounts.models import User, Address, PlatformSetting
from apps.restaurants.models import Restaurant, OperatingHours
from apps.menus.models import MenuCategory, MenuItem, ModifierGroup, Modifier

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        username='customer1',
        password='password123',
        first_name='أحمد',
        last_name='علي',
        phone_number='+966501111111',
        role=User.Roles.CUSTOMER
    )

@pytest.fixture
def merchant_user(db):
    return User.objects.create_user(
        username='merchant1',
        password='password123',
        first_name='سعد',
        last_name='المطيري',
        phone_number='+966502222222',
        role=User.Roles.MERCHANT
    )

@pytest.fixture
def driver_user(db):
    user = User.objects.create_user(
        username='driver1',
        password='password123',
        first_name='فهد',
        last_name='الغامدي',
        phone_number='+966503333333',
        role=User.Roles.DRIVER
    )
    from apps.deliveries.models import DriverProfile
    DriverProfile.objects.create(
        user=user,
        vehicle_type='MOTORCYCLE',
        is_online=True,
        current_latitude=24.7136,
        current_longitude=46.6753
    )
    return user

@pytest.fixture
def restaurant(db, merchant_user):
    return Restaurant.objects.create(
        owner=merchant_user,
        name='بيتزا فوكس',
        description='أشهى بيتزا إيطالية في المدينة',
        address_text='شارع الملك فهد، الرياض',
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=15.0,
        currency='SAR',
        min_order_amount=30.00,
        delivery_fee=12.00,
        estimated_prep_time_minutes=20,
        is_active=True
    )

@pytest.fixture
def menu_item(db, restaurant):
    category = MenuCategory.objects.create(
        restaurant=restaurant,
        name='بيتزا مميزة',
        order=1
    )
    item = MenuItem.objects.create(
        category=category,
        name='مارجريتا سوبريم',
        description='جبنة موزاريلا وصلصة الطماطم الخاصة',
        base_price=45.00,
        is_available=True
    )
    mod_group = ModifierGroup.objects.create(
        menu_item=item,
        name='الحجم',
        is_required=True,
        min_selections=1,
        max_selections=1
    )
    Modifier.objects.create(
        group=mod_group,
        name='كبير L',
        price_delta=10.00
    )
    Modifier.objects.create(
        group=mod_group,
        name='وسط M',
        price_delta=0.00
    )
    return item

@pytest.fixture
def customer_address(db, customer_user):
    return Address.objects.create(
        user=customer_user,
        title='المنزل',
        street='شارع العليا',
        building_number='12',
        floor='3',
        apartment_number='7',
        delivery_instructions='يرجى ترك الطلب عند الباب',
        latitude=24.715000,
        longitude=46.676000,
        is_default=True
    )
