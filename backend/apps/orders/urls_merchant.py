from django.urls import path
from .views import MerchantOrderListView, MerchantOrderDetailView, MerchantUpdateOrderStatusView

urlpatterns = [
    path('', MerchantOrderListView.as_view(), name='merchant-order-list'),
    path('live/', MerchantOrderListView.as_view(), name='merchant-order-live-list'),
    path('<uuid:id>/', MerchantOrderDetailView.as_view(), name='merchant-order-detail'),
    path('<uuid:id>/status/', MerchantUpdateOrderStatusView.as_view(), name='merchant-order-update-status'),
]
