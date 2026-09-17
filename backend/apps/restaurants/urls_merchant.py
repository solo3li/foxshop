from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MerchantRestaurantViewSet, MerchantToggleBusyView

router = DefaultRouter()
router.register('', MerchantRestaurantViewSet, basename='merchant-restaurant')

urlpatterns = [
    path('<uuid:pk>/toggle-busy/', MerchantToggleBusyView.as_view(), name='merchant-toggle-busy'),
    path('', include(router.urls)),
]
