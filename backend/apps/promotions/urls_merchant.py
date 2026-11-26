from django.urls import path
from .views import MerchantCouponListCreateView, MerchantCouponToggleView

urlpatterns = [
    path('', MerchantCouponListCreateView.as_view(), name='merchant-coupons-root'),
    path('coupons/', MerchantCouponListCreateView.as_view(), name='merchant-coupon-list-create'),
    path('coupons', MerchantCouponListCreateView.as_view(), name='merchant-coupon-list-create-no-slash'),
    path('coupons/<uuid:pk>/toggle/', MerchantCouponToggleView.as_view(), name='merchant-coupon-toggle'),
    path('coupons/<uuid:pk>/toggle', MerchantCouponToggleView.as_view(), name='merchant-coupon-toggle-no-slash'),
]
