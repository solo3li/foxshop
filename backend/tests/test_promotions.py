import pytest
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from apps.promotions.models import Coupon, CouponUsage

@pytest.mark.django_db
def test_coupon_validation_success(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)
    
    # Create 20% discount coupon up to 20 SAR on orders above 50 SAR
    coupon = Coupon.objects.create(
        code='FOX20',
        discount_type=Coupon.DiscountTypes.PERCENT,
        discount_value=20.00,
        min_order_amount=50.00,
        max_discount_amount=20.00,
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=7),
        is_active=True
    )

    # Valid check (subtotal: 100 -> 20% of 100 = 20)
    payload = {'code': 'FOX20', 'subtotal': '100.00'}
    response = api_client.post('/api/v1/customer/promotions/validate/', payload, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.data['valid'] is True
    assert float(response.data['discount_amount']) == 20.00
    assert float(response.data['final_subtotal']) == 80.00

@pytest.mark.django_db
def test_coupon_below_min_amount(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)
    Coupon.objects.create(
        code='FOX50',
        discount_type=Coupon.DiscountTypes.FLAT,
        discount_value=10.00,
        min_order_amount=100.00,
        valid_from=timezone.now() - timedelta(days=1),
        valid_to=timezone.now() + timedelta(days=7)
    )

    payload = {'code': 'FOX50', 'subtotal': '50.00'}
    response = api_client.post('/api/v1/customer/promotions/validate/', payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "الحد الأدنى" in response.data['error']
