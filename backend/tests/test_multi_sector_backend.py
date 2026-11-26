import pytest
from django.apps import apps
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from rest_framework import status

from apps.accounts.models import User
from apps.deliveries.admin import DeliveryTripAdmin
from apps.deliveries.models import DeliveryTrip
from apps.menus.admin import MenuCategoryAdmin, MenuItemAdmin
from apps.menus.models import MenuCategory, MenuItem
from apps.orders.admin import OrderAdmin
from apps.orders.models import Order
from apps.payments.admin import VendorPayoutAdmin
from apps.payments.models import VendorPayout
from apps.restaurants.admin import RestaurantAdmin
from apps.restaurants.models import Restaurant
from apps.reviews.admin import OrderReviewAdmin
from apps.reviews.models import OrderReview


@pytest.mark.django_db
def test_appconfig_verbose_names():
    """Verify AppConfig verbose names are updated to multi-sector terminology."""
    restaurants_config = apps.get_app_config('restaurants')
    assert restaurants_config.verbose_name == 'المتاجر والشركاء'

    menus_config = apps.get_app_config('menus')
    assert menus_config.verbose_name == 'كتالوج المنتجات والمخزون'


@pytest.mark.django_db
def test_model_verbose_names_and_status_labels():
    """Verify Arabic multi-sector strings and labels across models."""
    # Order Status PENDING
    assert dict(Order.Status.choices)[Order.Status.PENDING] == 'بانتظار موافقة المتجر'
    assert Order._meta.verbose_name == "طلب"
    assert Order._meta.verbose_name_plural == "إدارة الطلبات"
    assert Order._meta.get_field('customer_notes').verbose_name == "ملاحظات العميل للمتجر"

    # Restaurant
    assert Restaurant._meta.verbose_name == "متجر / شريك"
    assert Restaurant._meta.verbose_name_plural == "المتاجر والشركاء"
    assert Restaurant._meta.get_field('name').verbose_name == "اسم المتجر"
    assert Restaurant._meta.get_field('description').verbose_name == "وصف المتجر"
    assert Restaurant._meta.get_field('currency').verbose_name == "عملة المتجر"
    assert Restaurant._meta.get_field('estimated_prep_time_minutes').verbose_name == "متوسط وقت التجهيز والتحضير بالدقائق"

    # MenuCategory and MenuItem
    assert MenuCategory._meta.verbose_name == "تصنيف المنتجات"
    assert MenuCategory._meta.verbose_name_plural == "أقسام وتصنيفات المنتجات"
    assert MenuItem._meta.verbose_name == "منتج / صنف"
    assert MenuItem._meta.verbose_name_plural == "المنتجات والأصناف"
    assert MenuItem._meta.get_field('name').verbose_name == "اسم المنتج / الصنف"

    # VendorPayout
    assert VendorPayout._meta.verbose_name == "تسوية مستحقات متجر"
    assert VendorPayout._meta.verbose_name_plural == "تسويات المتاجر والشركاء الأسبوعية"
    assert VendorPayout._meta.get_field('gross_sales').verbose_name == "إجمالي مبيعات المنتجات"

    # DeliveryTrip & DeliveryOffer
    assert dict(DeliveryTrip.Status.choices)[DeliveryTrip.Status.ACCEPTED] == 'الكابتن قبل الطلب ومتجه للمتجر'
    assert dict(DeliveryTrip.Status.choices)[DeliveryTrip.Status.ARRIVED_AT_STORE] == 'وصل إلى المتجر'

    # OrderReview
    assert OrderReview._meta.get_field('restaurant').verbose_name == "المتجر"
    assert OrderReview._meta.get_field('restaurant_comment').verbose_name == "تعليق على المتجر"
    assert OrderReview._meta.get_field('merchant_reply').verbose_name == "رد صاحب المتجر / التاجر"


@pytest.mark.django_db
def test_restaurant_admin_bug_fix_and_badges(admin_user, restaurant):
    """Verify RestaurantAdmin search bug fix and store_type visual badge."""
    site = AdminSite()
    admin_instance = RestaurantAdmin(Restaurant, site)
    rf = RequestFactory()

    # 1. Test search query does not crash with FieldError
    req = rf.get('/admin/restaurants/restaurant/?q=testsearch')
    req.user = admin_user
    qs, use_distinct = admin_instance.get_search_results(req, Restaurant.objects.all(), 'testsearch')
    assert qs is not None

    # Search by owner phone number
    restaurant.owner.phone_number = '+966512345678'
    restaurant.owner.save()
    req_phone = rf.get('/admin/restaurants/restaurant/?q=512345678')
    req_phone.user = admin_user
    qs_phone, _ = admin_instance.get_search_results(req_phone, Restaurant.objects.all(), '512345678')
    assert qs_phone.filter(id=restaurant.id).exists()

    # 2. Test store_type badge rendering
    badge_html = admin_instance.store_type_badge(restaurant)
    assert '🍔 مطعم' in badge_html

    # Test supermarket badge
    restaurant.store_type = Restaurant.StoreType.SUPERMARKET
    restaurant.save()
    badge_html_sm = admin_instance.store_type_badge(restaurant)
    assert '🛒 سوبرماركت' in badge_html_sm

    # 3. Test list_filter and fieldsets
    assert 'store_type' in admin_instance.list_filter
    fieldset_titles = [f[0] for f in admin_instance.fieldsets]
    assert any('Store & Sector Info' in t or 'بيانات المتجر والقطاع' in t for t in fieldset_titles)


@pytest.mark.django_db
def test_cross_app_admin_store_type_filters():
    """Verify cross-app admin classes have store_type in list_filter."""
    assert 'restaurant__store_type' in OrderAdmin.list_filter
    assert 'category__restaurant__store_type' in MenuItemAdmin.list_filter
    assert 'restaurant__store_type' in MenuCategoryAdmin.list_filter
    assert 'restaurant__store_type' in VendorPayoutAdmin.list_filter
    assert 'order__restaurant__store_type' in DeliveryTripAdmin.list_filter
    assert 'restaurant__store_type' in OrderReviewAdmin.list_filter


@pytest.mark.django_db
def test_supervisor_live_orders_store_type_filtering(api_client, admin_user, restaurant):
    """Verify SupervisorLiveOrdersDispatchView filters by store_type and serializes store_type."""
    api_client.force_authenticate(user=admin_user)

    # Create a supermarket store and orders
    supermarket = Restaurant.objects.create(
        owner=restaurant.owner,
        name="سوبرماركت التميمي",
        store_type=Restaurant.StoreType.SUPERMARKET,
        delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
        address_text="طريق الملك فهد، الرياض",
        latitude=24.7136,
        longitude=46.6753,
    )

    # Order 1 in RESTAURANT
    order_rest = Order.objects.create(
        customer=admin_user,
        restaurant=restaurant,
        status=Order.Status.CONFIRMED,
        subtotal=100.00,
        delivery_fee=15.00,
        total_amount=115.00,
        currency='SAR'
    )

    # Order 2 in SUPERMARKET
    order_market = Order.objects.create(
        customer=admin_user,
        restaurant=supermarket,
        status=Order.Status.CONFIRMED,
        subtotal=200.00,
        delivery_fee=20.00,
        total_amount=220.00,
        currency='SAR'
    )

    # 1. Unfiltered live orders request -> should contain both orders
    res_all = api_client.get('/api/v1/deliveries/supervisor/live-orders/')
    assert res_all.status_code == status.HTTP_200_OK
    order_ids_all = [o['id'] for o in res_all.data['orders']]
    assert str(order_rest.id) in order_ids_all
    assert str(order_market.id) in order_ids_all

    # Check store_type is present in restaurant object
    found_market = next(o for o in res_all.data['orders'] if o['id'] == str(order_market.id))
    assert 'store_type' in found_market['restaurant']
    assert found_market['restaurant']['store_type'] == Restaurant.StoreType.SUPERMARKET

    found_rest = next(o for o in res_all.data['orders'] if o['id'] == str(order_rest.id))
    assert found_rest['restaurant']['store_type'] == Restaurant.StoreType.RESTAURANT

    # 2. Filter by store_type=SUPERMARKET
    res_market = api_client.get('/api/v1/deliveries/supervisor/live-orders/?store_type=SUPERMARKET')
    assert res_market.status_code == status.HTTP_200_OK
    order_ids_market = [o['id'] for o in res_market.data['orders']]
    assert str(order_market.id) in order_ids_market
    assert str(order_rest.id) not in order_ids_market

    # 3. Filter by store_type=RESTAURANT
    res_rest = api_client.get('/api/v1/deliveries/supervisor/live-orders/?store_type=RESTAURANT')
    assert res_rest.status_code == status.HTTP_200_OK
    order_ids_rest = [o['id'] for o in res_rest.data['orders']]
    assert str(order_rest.id) in order_ids_rest
    assert str(order_market.id) not in order_ids_rest

    # 4. Also verify the supervisor dashboard dispatch/orders/ endpoint works with store_type filter
    res_dispatch_sm = api_client.get('/api/v1/supervisor/dispatch/orders/?store_type=SUPERMARKET')
    assert res_dispatch_sm.status_code == status.HTTP_200_OK
    dispatch_ids_sm = [o['id'] for o in res_dispatch_sm.data['orders']]
    assert str(order_market.id) in dispatch_ids_sm
    assert str(order_rest.id) not in dispatch_ids_sm
