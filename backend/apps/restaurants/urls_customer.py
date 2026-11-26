from django.urls import path
from .views import CustomerRestaurantListView, CustomerRestaurantDetailView, CustomerSearchView

urlpatterns = [
    path('', CustomerRestaurantListView.as_view(), name='customer-restaurant-list'),
    path('search/', CustomerSearchView.as_view(), name='customer-restaurant-search'),
    path('<uuid:id>/', CustomerRestaurantDetailView.as_view(), name='customer-restaurant-detail'),
]
