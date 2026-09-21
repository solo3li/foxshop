from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MerchantRestaurantViewSet,
    MerchantToggleBusyView,
    MerchantUpdateStoreStatusView,
    MerchantOperatingHoursView
)

router = DefaultRouter()
router.register('', MerchantRestaurantViewSet, basename='merchant-restaurant')

urlpatterns = [
    path('<uuid:pk>/toggle-busy/', MerchantToggleBusyView.as_view(), name='merchant-toggle-busy'),
    path('<uuid:pk>/update-status/', MerchantUpdateStoreStatusView.as_view(), name='merchant-update-status'),
    path('<uuid:pk>/operating-hours/', MerchantOperatingHoursView.as_view(), name='merchant-operating-hours'),
    path('', include(router.urls)),
]
