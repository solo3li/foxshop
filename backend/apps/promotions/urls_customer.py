from django.urls import path
from .views import CustomerValidateCouponView, CustomerListCouponsView

urlpatterns = [
    path('', CustomerListCouponsView.as_view(), name='customer-coupons-list'),
    path('validate/', CustomerValidateCouponView.as_view(), name='customer-coupon-validate'),
]
