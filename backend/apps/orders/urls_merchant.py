from django.urls import path
from .views import MerchantOrderListView, MerchantUpdateOrderStatusView

urlpatterns = [
    path('live/', MerchantOrderListView.as_view(), name='merchant-order-list'),
    path('<uuid:id>/status/', MerchantUpdateOrderStatusView.as_view(), name='merchant-order-update-status'),
]
