from django.urls import path
from .views import CustomerValidateCouponView

urlpatterns = [
    path('validate/', CustomerValidateCouponView.as_view(), name='customer-coupon-validate'),
]
