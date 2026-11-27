from django.urls import path
from .views import (
    CustomerRestaurantListView, CustomerRestaurantDetailView,
    CustomerSearchView, CustomerSectorListView, CustomerZoneDetectView
)

urlpatterns = [
    path('', CustomerRestaurantListView.as_view(), name='customer-restaurant-list'),
    path('search/', CustomerSearchView.as_view(), name='customer-restaurant-search'),
    path('sectors/', CustomerSectorListView.as_view(), name='customer-sector-list'),
    path('zones/', CustomerZoneDetectView.as_view(), name='customer-zone-list'),
    path('zones/detect/', CustomerZoneDetectView.as_view(), name='customer-zone-detect'),
    path('<uuid:id>/', CustomerRestaurantDetailView.as_view(), name='customer-restaurant-detail'),
]
