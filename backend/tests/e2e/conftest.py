import math
import json
import uuid
import sys
from decimal import Decimal
from datetime import datetime, timezone

import pytest
from rest_framework.test import APIClient
from django.conf import settings

from apps.accounts.models import User, Address
from apps.restaurants.models import Restaurant
from apps.menus.models import MenuCategory, MenuItem, ModifierGroup, Modifier
from apps.payments.models import Wallet, Transaction, Currency
from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.deliveries.models import ShiftSettlement, DriverCashSettlement, DriverProfile
from apps.notifications.services import publish_centrifugo_event


# ============================================================================
# User & Authentication Fixtures
# ============================================================================

@pytest.fixture
def supervisor_user(db):
    """User with OPS_MANAGER role for supervisor and fleet management operations."""
    uid = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        username=f'supervisor_e2e_{uid}',
        password='password123',
        first_name='سامي',
        last_name='المشرف',
        phone_number=f'+966504{uid[:5]}',
        role=User.Roles.OPS_MANAGER,
        is_staff=True,
    )


@pytest.fixture
def customer_user(db):
    """Isolated customer user for E2E tests."""
    uid = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        username=f'customer_e2e_{uid}',
        password='password123',
        first_name='أحمد',
        last_name='علي',
        phone_number=f'+966501{uid[:5]}',
        role=User.Roles.CUSTOMER
    )


@pytest.fixture
def merchant_user(db):
    """Isolated merchant user for E2E tests."""
    uid = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        username=f'merchant_e2e_{uid}',
        password='password123',
        first_name='سعد',
        last_name='المطيري',
        phone_number=f'+966502{uid[:5]}',
        role=User.Roles.MERCHANT
    )


@pytest.fixture
def driver_user(db):
    """Isolated driver user for E2E tests."""
    uid = uuid.uuid4().hex[:6]
    user = User.objects.create_user(
        username=f'driver_e2e_{uid}',
        password='password123',
        first_name='فهد',
        last_name='الغامدي',
        phone_number=f'+966503{uid[:5]}',
        role=User.Roles.DRIVER
    )
    DriverProfile.objects.create(
        user=user,
        vehicle_type='MOTORCYCLE',
        is_online=True,
        current_latitude=24.7136,
        current_longitude=46.6753
    )
    return user


@pytest.fixture
def customer_address(db, customer_user):
    """Isolated customer address for E2E tests."""
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


@pytest.fixture
def restaurant(db, merchant_user, egp_currency):
    """Isolated restaurant for E2E tests."""
    uid = uuid.uuid4().hex[:6]
    return Restaurant.objects.create(
        owner=merchant_user,
        name=f'بيتزا فوكس {uid}',
        description='أشهى بيتزا إيطالية في المدينة',
        address_text='شارع الملك فهد، الرياض',
        latitude=24.713600,
        longitude=46.675300,
        delivery_radius_km=15.0,
        currency=egp_currency,
        min_order_amount=30.00,
        delivery_fee=12.00,
        estimated_prep_time_minutes=20,
        is_active=True
    )


def _create_authenticated_client(user):
    """Creates an APIClient pre-authenticated with DRF force_authenticate and JWT Bearer token."""
    client = APIClient()
    client.force_authenticate(user=user)
    try:
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    except Exception:
        pass
    return client


@pytest.fixture
def auth_customer_client(customer_user):
    """Pre-authenticated APIClient for customer operations."""
    return _create_authenticated_client(customer_user)


@pytest.fixture
def auth_merchant_client(merchant_user):
    """Pre-authenticated APIClient for merchant/restaurant operations."""
    return _create_authenticated_client(merchant_user)


@pytest.fixture
def auth_driver_client(driver_user):
    """Pre-authenticated APIClient for driver delivery operations."""
    return _create_authenticated_client(driver_user)


@pytest.fixture
def auth_supervisor_client(supervisor_user):
    """Pre-authenticated APIClient for supervisor / ops operations."""
    return _create_authenticated_client(supervisor_user)


@pytest.fixture
def authenticated_client():
    """Factory fixture to create an authenticated APIClient for any specified user."""
    return _create_authenticated_client


# ============================================================================
# Wallet Fixtures
# ============================================================================

@pytest.fixture
def customer_wallet(db, customer_user):
    """Pre-funded wallet fixture with 1,000.00 EGP balance for customer."""
    wallet, _ = Wallet.objects.get_or_create(
        user=customer_user,
        defaults={'balance': Decimal('1000.00'), 'currency': 'EGP'}
    )
    wallet.balance = Decimal('1000.00')
    wallet.currency = 'EGP'
    wallet.save()
    return wallet


@pytest.fixture
def zero_balance_wallet(db, customer_user):
    """Zero-balance wallet fixture for testing balance validation and NSF errors."""
    wallet, _ = Wallet.objects.get_or_create(
        user=customer_user,
        defaults={'balance': Decimal('0.00'), 'currency': 'EGP'}
    )
    wallet.balance = Decimal('0.00')
    wallet.currency = 'EGP'
    wallet.save()
    return wallet


@pytest.fixture
def driver_wallet(db, driver_user):
    """Pre-funded wallet fixture with 500.00 EGP balance for driver."""
    wallet, _ = Wallet.objects.get_or_create(
        user=driver_user,
        defaults={'balance': Decimal('500.00'), 'currency': 'EGP'}
    )
    wallet.balance = Decimal('500.00')
    wallet.currency = 'EGP'
    wallet.save()
    return wallet


# ============================================================================
# Menu Item Fixtures
# ============================================================================

@pytest.fixture
def weighted_menu_item(db, restaurant):
    """MenuItem configured with is_weighted=True, pricing_unit='KG', and unit price."""
    category, _ = MenuCategory.objects.get_or_create(
        restaurant=restaurant,
        name='قسم اللحوم الطازجة بالوزن',
        defaults={'order': 10}
    )
    item = MenuItem.objects.create(
        category=category,
        name='لحم عجل بلدي فاخر (بالكيلو)',
        description='لحم بقري طازج يباع بالوزن الفعلي',
        base_price=Decimal('120.00'),
        pricing_unit=MenuItem.PricingUnit.KG,
        is_available=True,
    )
    item.is_weighted = True
    item.unit = 'KG'
    item.price_per_unit = item.base_price
    return item


# ============================================================================
# Centrifugo Mock & Spy Fixture
# ============================================================================

class CentrifugoEvent(dict):
    """Dictionary representing a captured Centrifugo event supporting attribute and key access."""
    def __init__(self, channel, event_type, payload=None, **extra):
        p = payload if payload is not None else {}
        super().__init__(
            channel=channel,
            event_type=event_type,
            payload=p,
            data=p,
            timestamp=extra.get('timestamp') or datetime.now(timezone.utc).isoformat(),
            **extra
        )
        if isinstance(p, dict):
            self.update(p)

    @property
    def channel(self):
        return self.get('channel')

    @property
    def event_type(self):
        return self.get('event_type')

    @property
    def payload(self):
        return self.get('payload')

    @property
    def data(self):
        return self.get('payload')

    @property
    def timestamp(self):
        return self.get('timestamp')


class CentrifugoSpy:
    """Spy that records all Centrifugo publication calls and provides test inspection methods."""
    def __init__(self):
        self.events = []

    def record(self, channel, event_type, data=None, **kwargs):
        payload = data if data is not None else kwargs.get('payload', {})
        rec = CentrifugoEvent(channel=channel, event_type=event_type, payload=payload, **kwargs)
        self.events.append(rec)
        return True

    def __call__(self, channel, event_type, data=None, **kwargs):
        return self.record(channel, event_type, data=data, **kwargs)

    def publish(self, channel, event_type, data=None, **kwargs):
        return self.record(channel, event_type, data=data, **kwargs)

    def filter(self, channel=None, event_type=None):
        res = self.events
        if channel:
            res = [e for e in res if e.channel == channel or channel in str(e.channel)]
        if event_type:
            res = [e for e in res if str(e.event_type).upper() == str(event_type).upper()]
        return res

    def has_event(self, channel=None, event_type=None):
        return len(self.filter(channel=channel, event_type=event_type)) > 0

    def assert_published(self, channel=None, event_type=None, count=None):
        matched = self.filter(channel=channel, event_type=event_type)
        if count is not None:
            assert len(matched) == count, (
                f"Expected {count} Centrifugo events (channel={channel}, event_type={event_type}), "
                f"found {len(matched)}. All events: {self.events}"
            )
        else:
            assert len(matched) > 0, (
                f"Expected Centrifugo event (channel={channel}, event_type={event_type}), "
                f"found none. All events: {self.events}"
            )

    def clear(self):
        self.events.clear()


@pytest.fixture
def mock_centrifugo(monkeypatch):
    """Spy fixture intercepting Centrifugo publish calls across all modules."""
    spy = CentrifugoSpy()

    # 1. Patch requests.post in apps.notifications.services as network-level fallback
    import requests
    orig_post = requests.post

    def mock_post(url, *args, **kwargs):
        if 'publish' in url or (hasattr(settings, 'CENTRIFUGO_API_URL') and settings.CENTRIFUGO_API_URL in url):
            json_data = kwargs.get('json', {})
            ch = json_data.get('channel')
            ev_data = json_data.get('data', {})
            ev_type = ev_data.get('event')
            payload = ev_data.get('payload', ev_data)
            spy.record(channel=ch, event_type=ev_type, data=payload)
            class DummyResp:
                status_code = 200
                text = '{"status": "ok"}'
                def json(self):
                    return {"status": "ok"}
            return DummyResp()
        return orig_post(url, *args, **kwargs)

    monkeypatch.setattr('apps.notifications.services.requests.post', mock_post)

    # 2. Patch primary service function
    monkeypatch.setattr('apps.notifications.services.publish_centrifugo_event', spy.record)

    # 3. Patch across all loaded modules in sys.modules that reference publish_centrifugo_event
    for mod in list(sys.modules.values()):
        if mod and hasattr(mod, 'publish_centrifugo_event'):
            try:
                monkeypatch.setattr(mod, 'publish_centrifugo_event', spy.record)
            except Exception:
                pass

    # 4. Provide alias support for centrifugo.client.publish if imported dynamically
    try:
        import types
        cent_mod = types.ModuleType('centrifugo')
        cl_mod = types.ModuleType('centrifugo.client')
        cl_mod.publish = spy.record
        cent_mod.client = cl_mod
        sys.modules['centrifugo'] = cent_mod
        sys.modules['centrifugo.client'] = cl_mod
    except Exception:
        pass

    return spy


# ============================================================================
# Inngest Mock & Spy Fixture
# ============================================================================

class InngestEventRecord(dict):
    """Dictionary representing a captured Inngest event with attribute access."""
    def __init__(self, name, data, raw=None):
        super().__init__(name=name, data=data or {}, raw=raw)

    @property
    def name(self):
        return self.get('name')

    @property
    def data(self):
        return self.get('data')


class InngestSpy:
    """Spy that intercepts Inngest event transmissions and records events for assertions."""
    def __init__(self):
        self.events = []

    def record_event(self, event):
        if isinstance(event, dict):
            name = event.get('name')
            data = event.get('data', {})
        else:
            name = getattr(event, 'name', None)
            data = getattr(event, 'data', {})
        rec = InngestEventRecord(name=name, data=data, raw=event)
        self.events.append(rec)
        return rec

    def send_sync(self, events, *args, **kwargs):
        if not isinstance(events, (list, tuple)):
            events = [events]
        res = [self.record_event(e) for e in events]
        return [f"inngest-evt-{i}" for i in range(len(res))]

    def send(self, events, *args, **kwargs):
        return self.send_sync(events, *args, **kwargs)

    def filter(self, name=None):
        if name:
            return [e for e in self.events if e.name == name]
        return self.events

    def has_event(self, name=None):
        return len(self.filter(name=name)) > 0

    def assert_sent(self, name=None, count=None):
        matched = self.filter(name=name)
        if count is not None:
            assert len(matched) == count, (
                f"Expected {count} Inngest events (name={name}), found {len(matched)}. "
                f"All events: {self.events}"
            )
        else:
            assert len(matched) > 0, (
                f"Expected Inngest event (name={name}), found none. All events: {self.events}"
            )

    def clear(self):
        self.events.clear()


@pytest.fixture
def mock_inngest(monkeypatch):
    """Spy fixture intercepting Inngest event sends (send_sync and send)."""
    spy = InngestSpy()

    # Patch core.inngest_client.inngest_client
    try:
        from core.inngest_client import inngest_client
        monkeypatch.setattr(inngest_client, 'send_sync', spy.send_sync)
        monkeypatch.setattr(inngest_client, 'send', spy.send)
    except Exception:
        pass

    # Patch inngest.Inngest class methods
    try:
        import inngest
        monkeypatch.setattr(inngest.Inngest, 'send_sync', lambda self, events, *a, **kw: spy.send_sync(events, *a, **kw))
        monkeypatch.setattr(inngest.Inngest, 'send', lambda self, events, *a, **kw: spy.send(events, *a, **kw))
    except Exception:
        pass

    return spy


# ============================================================================
# Redis Geospatial Mock & Tracking Fixture
# ============================================================================

def _haversine_distance_meters(lon1, lat1, lon2, lat2):
    """Calculates Haversine distance in meters between two GPS coordinates."""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class MockPipeline:
    def __init__(self, client):
        self.client = client
        self.commands = []

    def geoadd(self, *args, **kwargs):
        self.commands.append(lambda: self.client.geoadd(*args, **kwargs))
        return self

    def set(self, *args, **kwargs):
        self.commands.append(lambda: self.client.set(*args, **kwargs))
        return self

    def get(self, *args, **kwargs):
        self.commands.append(lambda: self.client.get(*args, **kwargs))
        return self

    def execute(self):
        return [cmd() for cmd in self.commands]


class MockRedisGeoClient:
    """In-memory Redis client supporting Geospatial and KV operations for fast test execution."""
    def __init__(self):
        self._geo = {}  # {key: {member: (lon, lat)}}
        self._data = {}  # {key: value}
        self.calls = []

    def geoadd(self, key, *args, **kwargs):
        self.calls.append(('geoadd', key, args, kwargs))
        if key not in self._geo:
            self._geo[key] = {}

        entries = []
        if 'mapping' in kwargs:
            for member, coords in kwargs['mapping'].items():
                entries.append((str(member), float(coords[0]), float(coords[1])))

        i = 0
        while i < len(args):
            item = args[i]
            if isinstance(item, (list, tuple)) and len(item) == 3:
                lon, lat, member = item
                entries.append((str(member), float(lon), float(lat)))
                i += 1
            elif i + 2 < len(args):
                lon, lat, member = args[i], args[i + 1], args[i + 2]
                entries.append((str(member), float(lon), float(lat)))
                i += 3
            else:
                i += 1

        for member, lon, lat in entries:
            self._geo[key][member] = (lon, lat)
        return len(entries)

    def geopos(self, key, *members):
        self.calls.append(('geopos', key, members))
        store = self._geo.get(key, {})
        return [store.get(str(m)) for m in members]

    def geodist(self, key, member1, member2, unit='m'):
        self.calls.append(('geodist', key, member1, member2, unit))
        pos = self.geopos(key, member1, member2)
        if not pos[0] or not pos[1]:
            return None
        dist_m = _haversine_distance_meters(pos[0][0], pos[0][1], pos[1][0], pos[1][1])
        if unit == 'km':
            return dist_m / 1000.0
        return dist_m

    def geosearch(self, key, longitude=None, latitude=None, member=None, radius=None, unit='m', **kwargs):
        self.calls.append(('geosearch', key, longitude, latitude, radius, unit))
        store = self._geo.get(key, {})
        center_lon, center_lat = None, None
        if member and member in store:
            center_lon, center_lat = store[member]
        elif longitude is not None and latitude is not None:
            center_lon, center_lat = float(longitude), float(latitude)

        if center_lon is None or radius is None:
            return list(store.keys())

        radius_m = float(radius) * (1000.0 if unit == 'km' else 1.0)
        matched = []
        for m, (lon, lat) in store.items():
            if _haversine_distance_meters(center_lon, center_lat, lon, lat) <= radius_m:
                matched.append(m)
        return matched

    def georadius(self, key, longitude, latitude, radius, unit='m', **kwargs):
        return self.geosearch(key, longitude=longitude, latitude=latitude, radius=radius, unit=unit, **kwargs)

    def set(self, key, value, ex=None, px=None, **kwargs):
        self.calls.append(('set', key, value))
        self._data[key] = value
        return True

    def get(self, key):
        self.calls.append(('get', key))
        return self._data.get(key)

    def delete(self, *keys):
        self.calls.append(('delete', keys))
        count = 0
        for k in keys:
            if k in self._data:
                del self._data[k]
                count += 1
            if k in self._geo:
                del self._geo[k]
                count += 1
        return count

    def zrem(self, key, *members):
        self.calls.append(('zrem', key, members))
        if key in self._geo:
            for m in members:
                self._geo[key].pop(str(m), None)
        return 1

    def zrange(self, key, start=0, stop=-1, **kwargs):
        self.calls.append(('zrange', key, start, stop))
        if key in self._geo:
            members = list(self._geo[key].keys())
            if stop == -1:
                return members[start:]
            return members[start:stop + 1]
        return []

    def ping(self):
        return True

    def pipeline(self, transaction=True, shard_hint=None):
        return MockPipeline(self)


class RedisGeoSpy:
    """Helper wrapper around MockRedisGeoClient for high-level test assertions."""
    def __init__(self, client):
        self.client = client

    def get_driver_coords(self, driver_id, key="drivers:active"):
        store = self.client._geo.get(key, {})
        return store.get(str(driver_id))

    def get_driver_pos_cache(self, driver_id):
        raw = self.client.get(f"driver:{driver_id}:pos")
        if raw and isinstance(raw, str):
            try:
                return json.loads(raw)
            except Exception:
                return raw
        return raw

    def clear(self):
        self.client._geo.clear()
        self.client._data.clear()
        self.client.calls.clear()


@pytest.fixture
def mock_redis_geo(monkeypatch):
    """Fixture providing a mock Redis Geospatial client for driver GPS tracking tests."""
    client = MockRedisGeoClient()
    spy = RedisGeoSpy(client)

    # Patch deliveries get_redis_client
    monkeypatch.setattr('apps.deliveries.services.get_redis_client', lambda: client)

    # Patch redis.from_url to intercept any other direct connections
    try:
        import redis
        monkeypatch.setattr(redis, 'from_url', lambda *a, **kw: client)
    except Exception:
        pass

    return spy


# ============================================================================
# Order & Shift Settlement Factory Fixtures
# ============================================================================

@pytest.fixture
def order_factory(db, customer_user, restaurant, customer_address, menu_item):
    """Factory fixture to create test Orders across all statuses and payment methods."""
    def _create_order(
        customer=None,
        restaurant_instance=None,
        address=None,
        status=Order.Status.PENDING,
        payment_method=Order.PaymentMethod.WALLET,
        payment_status=None,
        items=None,
        delivery_fee=Decimal('15.00'),
        discount_amount=Decimal('0.00'),
        preauth_hold_amount=Decimal('0.00'),
        currency='EGP',
        customer_notes='',
        is_weight_confirmed=False,
    ):
        cust = customer or customer_user
        rest = restaurant_instance or restaurant
        addr = address or customer_address

        # Default payment status logic
        if payment_status is None:
            if payment_method == Order.PaymentMethod.WALLET and status != Order.Status.CANCELLED:
                payment_status = Order.PaymentStatus.PAID
            else:
                payment_status = Order.PaymentStatus.PENDING

        # Default items if none provided
        if items is None:
            items = [{
                'menu_item': menu_item,
                'quantity': 2,
                'unit_price': menu_item.base_price,
                'is_weighted': False,
                'requested_weight': None,
                'actual_weight': None,
            }]

        subtotal = Decimal('0.00')
        weighted_subtotal = Decimal('0.00')
        item_rows = []

        for it in items:
            m_item = it.get('menu_item', menu_item)
            qty = it.get('quantity', 1)
            u_price = Decimal(str(it.get('unit_price', m_item.base_price)))
            is_w = it.get('is_weighted', False)
            req_w = it.get('requested_weight')
            act_w = it.get('actual_weight')

            if is_w and req_w is not None:
                line_total = Decimal(str(req_w)) * u_price
            else:
                line_total = Decimal(str(qty)) * u_price

            subtotal += line_total
            if is_w:
                weighted_subtotal += line_total

            item_rows.append({
                'menu_item': m_item,
                'item_name': m_item.name,
                'unit_price': u_price,
                'quantity': qty,
                'is_weighted': is_w,
                'requested_weight': req_w,
                'actual_weight': act_w,
                'total_price': line_total,
            })

        # Calculate preauth hold for weighted items on CARD payments
        hold_amt = preauth_hold_amount
        if hold_amt == Decimal('0.00') and payment_method == Order.PaymentMethod.CARD and weighted_subtotal > 0:
            hold_amt = round(weighted_subtotal * Decimal('0.15'), 2)

        total_amount = subtotal + Decimal(str(delivery_fee)) - Decimal(str(discount_amount)) + hold_amt

        addr_snapshot = {}
        if addr:
            addr_snapshot = {
                'title': addr.title,
                'street': addr.street,
                'building_number': addr.building_number,
                'floor': addr.floor,
                'apartment_number': addr.apartment_number,
                'latitude': float(addr.latitude or 0.0),
                'longitude': float(addr.longitude or 0.0),
            }

        order = Order.objects.create(
            customer=cust,
            restaurant=rest,
            delivery_address=addr,
            delivery_address_snapshot=addr_snapshot,
            status=status,
            payment_method=payment_method,
            payment_status=payment_status,
            currency=currency,
            subtotal=subtotal,
            delivery_fee=Decimal(str(delivery_fee)),
            discount_amount=Decimal(str(discount_amount)),
            total_amount=total_amount,
            preauth_hold_amount=hold_amt,
            is_weight_confirmed=is_weight_confirmed,
            customer_notes=customer_notes,
        )

        for row in item_rows:
            OrderItem.objects.create(
                order=order,
                menu_item=row['menu_item'],
                item_name=row['item_name'],
                unit_price=row['unit_price'],
                quantity=row['quantity'],
                is_weighted=row['is_weighted'],
                requested_weight=row['requested_weight'],
                actual_weight=row['actual_weight'],
                total_price=row['total_price'],
            )

        OrderStatusHistory.objects.create(
            order=order,
            status=status,
            note=f"Order created via order_factory with status {status}"
        )

        return order

    return _create_order


@pytest.fixture
def shift_settlement_factory(db, restaurant, driver_user, supervisor_user):
    """Factory fixture to create driver shift settlements and supervisor cash handovers."""
    def _create_settlement(
        restaurant_instance=None,
        driver=None,
        orders=None,
        total_goods_amount=Decimal('500.00'),
        platform_commission_amount=Decimal('75.00'),
        status=ShiftSettlement.Status.PENDING,
        otp_code=None,
        notes="تسوية وردية كاش تجريبية",
        settled_at=None,
    ):
        rest = restaurant_instance or restaurant
        drv = driver or driver_user

        settlement = ShiftSettlement.objects.create(
            restaurant=rest,
            driver=drv,
            total_goods_amount=Decimal(str(total_goods_amount)),
            platform_commission_amount=Decimal(str(platform_commission_amount)),
            status=status,
            otp_code=otp_code or "123456",
            notes=notes,
            settled_at=settled_at,
        )

        if orders:
            settlement.orders.set(orders)
            settlement.orders_count = len(orders)
            settlement.save(update_fields=['orders_count'])

        return settlement

    def _create_cash_settlement(
        driver=None,
        supervisor=None,
        amount=Decimal('300.00'),
        status=DriverCashSettlement.Status.APPROVED,
        balance_before=Decimal('300.00'),
        balance_after=Decimal('0.00'),
        notes="سند توريد كاش تجريبي",
    ):
        drv = driver or driver_user
        sup = supervisor or supervisor_user
        return DriverCashSettlement.objects.create(
            driver=drv,
            supervisor=sup,
            amount=Decimal(str(amount)),
            status=status,
            balance_before=Decimal(str(balance_before)),
            balance_after=Decimal(str(balance_after)),
            notes=notes,
        )

    _create_settlement.create_cash_settlement = _create_cash_settlement
    return _create_settlement
