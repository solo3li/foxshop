from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, DriverRegisterView, DriverCheckStatusView, PartnerRegisterView,
    LoginView, ProfileView, AddressViewSet, PublicPlatformConfigView, GeocodeSearchView
)

router = DefaultRouter()
router.register('addresses', AddressViewSet, basename='address')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('driver/register/', DriverRegisterView.as_view(), name='driver-register'),
    path('driver/check-status/', DriverCheckStatusView.as_view(), name='driver-check-status'),
    path('partner-register/', PartnerRegisterView.as_view(), name='partner-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', ProfileView.as_view(), name='user-profile'),
    path('me/', ProfileView.as_view(), name='user-me'),
    path('config/', PublicPlatformConfigView.as_view(), name='platform-config'),
    path('geocode-search/', GeocodeSearchView.as_view(), name='geocode-search'),
    path('', include(router.urls)),
]
