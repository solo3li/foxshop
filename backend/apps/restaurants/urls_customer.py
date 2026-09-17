from django.urls import path
from .views import CustomerRestaurantListView, CustomerRestaurantDetailView

urlpatterns = [
    path('', CustomerRestaurantListView.as_view(), name='customer-restaurant-list'),
    path('<uuid:id>/', CustomerRestaurantDetailView.as_view(), name='customer-restaurant-detail'),
]
