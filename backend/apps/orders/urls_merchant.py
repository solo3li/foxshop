from django.urls import path
from .views import (
    MerchantOrderListView,
    MerchantOrderDetailView,
    MerchantUpdateOrderStatusView,
    MerchantConfirmWeightsView
)

urlpatterns = [
    path('', MerchantOrderListView.as_view(), name='merchant-order-list'),
    path('live/', MerchantOrderListView.as_view(), name='merchant-order-live-list'),
    path('<uuid:id>/', MerchantOrderDetailView.as_view(), name='merchant-order-detail'),
    path('<uuid:id>/status/', MerchantUpdateOrderStatusView.as_view(), name='merchant-order-update-status'),
    path('<uuid:id>/confirm-weights/', MerchantConfirmWeightsView.as_view(), name='merchant-order-confirm-weights'),
    path('<uuid:id>/update-weights/', MerchantConfirmWeightsView.as_view(), name='merchant-order-update-weights'),
]
