from django.urls import path
from .views import CustomerOrderCreateView, CustomerOrderListView, CustomerOrderDetailView, CustomerCancelOrderView

urlpatterns = [
    path('checkout/', CustomerOrderCreateView.as_view(), name='customer-order-create'),
    path('history/', CustomerOrderListView.as_view(), name='customer-order-list'),
    path('<uuid:id>/', CustomerOrderDetailView.as_view(), name='customer-order-detail'),
    path('<uuid:id>/cancel/', CustomerCancelOrderView.as_view(), name='customer-order-cancel'),
]
