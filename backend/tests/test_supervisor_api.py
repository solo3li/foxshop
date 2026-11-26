import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.models import User, PlatformSetting
from apps.deliveries.models import DriverProfile, DeliveryTrip, DeliveryOffer, DriverCashSettlement
from apps.orders.models import Order
from apps.restaurants.models import Restaurant


@pytest.fixture
def supervisor_user(db):
    user = User.objects.create_user(
        username='supervisor_test',
        password='testpassword123',
        role=User.Roles.ADMIN,
        is_staff=True
    )
    return user


@pytest.fixture
def driver_user(db):
    user = User.objects.create_user(
        username='driver_radar_test',
        password='testpassword123',
        phone_number='+966599999999',
        role=User.Roles.DRIVER,
        is_active=True
    )
    profile = DriverProfile.objects.create(
        user=user,
        vehicle_type=DriverProfile.VehicleTypes.MOTORCYCLE,
        license_plate='TEST-999',
        is_online=True,
        is_busy=False,
        current_latitude=24.7136,
        current_longitude=46.6753,
        cash_in_hand=Decimal('150.00')
    )
    return user, profile


@pytest.fixture
def pending_driver_user(db):
    user = User.objects.create_user(
        username='driver_pending_test',
        password='testpassword123',
        phone_number='+966588888888',
        role=User.Roles.DRIVER,
        is_active=False
    )
    profile = DriverProfile.objects.create(
        user=user,
        vehicle_type=DriverProfile.VehicleTypes.CAR,
        license_plate='PEND-123',
        is_online=False,
        is_busy=False,
        cash_in_hand=Decimal('0.00')
    )
    return user, profile


@pytest.fixture
def sample_order(db, supervisor_user):
    from apps.payments.models import Currency
    currency, _ = Currency.objects.get_or_create(code='SAR', defaults={'name': 'ريال سعودي', 'symbol': 'ر.س'})
    restaurant = Restaurant.objects.create(
        name='مطعم البرجر التجريبي',
        owner=supervisor_user,
        currency=currency,
        latitude=24.7100,
        longitude=46.6700,
        delivery_fee=Decimal('15.00')
    )
    customer = User.objects.create_user(
        username='customer_test_order',
        password='password123',
        phone_number='+966577777777',
        role=User.Roles.CUSTOMER
    )
    order = Order.objects.create(
        customer=customer,
        restaurant=restaurant,
        status=Order.Status.READY_FOR_PICKUP,
        subtotal=Decimal('50.00'),
        delivery_fee=Decimal('15.00'),
        total_amount=Decimal('65.00')
    )
    return order


@pytest.mark.django_db
def test_supervisor_stats_and_radar(supervisor_user, driver_user):
    client = APIClient()
    client.force_authenticate(user=supervisor_user)

    # 1. Stats endpoint
    stats_res = client.get('/api/v1/supervisor/stats/')
    assert stats_res.status_code == 200
    assert 'fleet' in stats_res.data
    assert 'orders' in stats_res.data
    assert 'cash' in stats_res.data
    assert stats_res.data['fleet']['online_drivers'] >= 1

    # 2. Radar endpoint
    radar_res = client.get('/api/v1/supervisor/radar/')
    assert radar_res.status_code == 200
    assert 'drivers' in radar_res.data
    assert any(d['username'] == 'driver_radar_test' for d in radar_res.data['drivers'])


@pytest.mark.django_db
def test_supervisor_dispatch_and_manual_assign(supervisor_user, driver_user, sample_order):
    client = APIClient()
    client.force_authenticate(user=supervisor_user)
    driver, profile = driver_user

    # 1. Dispatch orders list
    orders_res = client.get('/api/v1/supervisor/dispatch/orders/')
    assert orders_res.status_code == 200
    assert orders_res.data['count'] >= 1

    # 2. Direct assignment
    assign_res = client.post(
        '/api/v1/supervisor/dispatch/assign/',
        {
            'order_id': str(sample_order.id),
            'driver_id': str(driver.id),
            'mode': 'direct'
        },
        format='json'
    )
    assert assign_res.status_code == 200
    assert assign_res.data['mode'] == 'direct'

    profile.refresh_from_db()
    assert profile.is_busy is True

    trip = DeliveryTrip.objects.get(order=sample_order)
    assert trip.driver == driver
    assert trip.status == DeliveryTrip.Status.ACCEPTED


@pytest.mark.django_db
def test_supervisor_cash_reconciliation_and_settlement(supervisor_user, driver_user):
    client = APIClient()
    client.force_authenticate(user=supervisor_user)
    driver, profile = driver_user

    # 1. Get reconciliation
    recon_res = client.get('/api/v1/supervisor/cash/reconciliation/')
    assert recon_res.status_code == 200
    assert 'cod_max_ceiling' in recon_res.data
    assert any(d['username'] == 'driver_radar_test' for d in recon_res.data['drivers'])

    # 2. Record settlement
    settle_res = client.post(
        '/api/v1/supervisor/cash/settle/',
        {
            'driver_id': str(driver.id),
            'amount': 50.00,
            'notes': 'توريد جزئي'
        },
        format='json'
    )
    assert settle_res.status_code == 200
    assert settle_res.data['balance_after'] == 100.00

    profile.refresh_from_db()
    assert profile.cash_in_hand == Decimal('100.00')
    assert DriverCashSettlement.objects.filter(driver=driver).count() == 1


@pytest.mark.django_db
def test_supervisor_driver_roster_and_approval(supervisor_user, pending_driver_user):
    client = APIClient()
    client.force_authenticate(user=supervisor_user)
    pending_user, profile = pending_driver_user

    # 1. Filter pending drivers
    roster_res = client.get('/api/v1/supervisor/drivers/?status=pending')
    assert roster_res.status_code == 200
    assert any(d['username'] == 'driver_pending_test' for d in roster_res.data['drivers'])

    # 2. Approve driver
    approve_res = client.post(
        f'/api/v1/supervisor/drivers/{pending_user.id}/action/',
        {'action': 'approve'},
        format='json'
    )
    assert approve_res.status_code == 200
    assert approve_res.data['is_active'] is True

    pending_user.refresh_from_db()
    assert pending_user.is_active is True


@pytest.fixture
def ops_manager_user(db):
    user = User.objects.create_user(
        username='ops_director_test',
        password='testpassword123',
        role=User.Roles.OPS_MANAGER,
        is_staff=True
    )
    return user


@pytest.fixture
def operational_supervisor_user(db):
    user = User.objects.create_user(
        username='op_sup_test',
        password='testpassword123',
        role=User.Roles.SUPERVISOR,
        is_staff=True
    )
    return user


@pytest.mark.django_db
def test_ops_manager_team_management(ops_manager_user):
    client = APIClient()
    client.force_authenticate(user=ops_manager_user)

    # 1. List team
    team_res = client.get('/api/v1/supervisor/ops/team/')
    assert team_res.status_code == 200
    assert 'members' in team_res.data
    assert any(m['username'] == 'ops_director_test' for m in team_res.data['members'])

    # 2. Create new supervisor
    create_res = client.post(
        '/api/v1/supervisor/ops/team/',
        {
            'username': 'new_supervisor_egy',
            'password': 'password12345',
            'first_name': 'أحمد',
            'last_name': 'محمود',
            'role': 'SUPERVISOR',
            'phone_number': '+201011122233'
        },
        format='json'
    )
    assert create_res.status_code == 201
    created_id = create_res.data['id']

    # 3. Toggle supervisor status (deactivate)
    toggle_res = client.patch(
        f'/api/v1/supervisor/ops/team/{created_id}/',
        {'is_active': False},
        format='json'
    )
    assert toggle_res.status_code == 200
    assert toggle_res.data['is_active'] is False


@pytest.mark.django_db
def test_graduated_cash_settlement_and_ops_approval(operational_supervisor_user, ops_manager_user, driver_user):
    driver, profile = driver_user
    profile.cash_in_hand = Decimal('1200.00')
    profile.save()

    # Configure supervisor limit to 500
    settings = PlatformSetting.get_settings()
    settings.supervisor_max_settlement_limit = Decimal('500.00')
    settings.save()

    sup_client = APIClient()
    sup_client.force_authenticate(user=operational_supervisor_user)

    # 1. Supervisor settles 800 (exceeds 500 limit) -> Should be PENDING_APPROVAL
    settle_res = sup_client.post(
        '/api/v1/supervisor/cash/settle/',
        {
            'driver_id': str(driver.id),
            'amount': 800.00,
            'notes': 'توريد عهدة كبيرة'
        },
        format='json'
    )
    assert settle_res.status_code == 200
    assert settle_res.data.get('pending_approval') is True
    assert settle_res.data.get('status') == 'PENDING_APPROVAL'
    settlement_id = settle_res.data['settlement_id']

    # Driver cash balance should NOT be deducted yet!
    profile.refresh_from_db()
    assert profile.cash_in_hand == Decimal('1200.00')

    # 2. Ops Manager checks pending approvals
    mgr_client = APIClient()
    mgr_client.force_authenticate(user=ops_manager_user)

    approvals_res = mgr_client.get('/api/v1/supervisor/ops/approvals/')
    assert approvals_res.status_code == 200
    assert any(a['id'] == settlement_id for a in approvals_res.data['pending_approvals'])

    # 3. Ops Manager approves the settlement
    approve_res = mgr_client.post(
        f'/api/v1/supervisor/ops/approvals/{settlement_id}/',
        {'action': 'approve'},
        format='json'
    )
    assert approve_res.status_code == 200
    assert approve_res.data['status'] == 'APPROVED'

    # Now driver cash balance should be deducted: 1200 - 800 = 400
    profile.refresh_from_db()
    assert profile.cash_in_hand == Decimal('400.00')

    # 4. Check audit log has records
    audit_res = mgr_client.get('/api/v1/supervisor/ops/audit-log/')
    assert audit_res.status_code == 200
    assert len(audit_res.data['logs']) >= 2


@pytest.mark.django_db
def test_ops_zones_and_analytics(ops_manager_user):
    client = APIClient()
    client.force_authenticate(user=ops_manager_user)

    # 1. Create a zone (Talabat style cluster)
    zone_res = client.post(
        '/api/v1/supervisor/ops/zones/',
        {
            'name': 'القاهرة الجديدة - التجمع',
            'code': 'NC-TAGAMOA-01',
            'city': 'القاهرة',
            'center_latitude': 30.0131,
            'center_longitude': 31.4913,
            'radius_km': 7.5
        },
        format='json'
    )
    assert zone_res.status_code == 201
    assert zone_res.data['code'] == 'NC-TAGAMOA-01'

    # 2. Get Zones list
    zones_list_res = client.get('/api/v1/supervisor/ops/zones/')
    assert zones_list_res.status_code == 200
    assert any(z['code'] == 'NC-TAGAMOA-01' for z in zones_list_res.data['zones'])

    # 3. Ops Analytics
    analytics_res = client.get('/api/v1/supervisor/ops/analytics/')
    assert analytics_res.status_code == 200
    assert 'team' in analytics_res.data
    assert 'leaderboard' in analytics_res.data
    assert 'zones' in analytics_res.data

