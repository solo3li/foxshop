from django.urls import path
from .views import CustomerRestaurantMenuListView, CustomerMenuItemDetailView

urlpatterns = [
    path('restaurant/<uuid:restaurant_id>/', CustomerRestaurantMenuListView.as_view(), name='customer-menu-list'),
    path('item/<uuid:id>/', CustomerMenuItemDetailView.as_view(), name='customer-menu-item-detail'),
]
