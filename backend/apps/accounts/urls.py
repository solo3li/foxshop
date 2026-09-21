from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, DriverRegisterView, LoginView, ProfileView,
    AddressViewSet, PublicPlatformConfigView
)

router = DefaultRouter()
router.register('addresses', AddressViewSet, basename='address')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('driver/register/', DriverRegisterView.as_view(), name='driver-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', ProfileView.as_view(), name='user-profile'),
    path('config/', PublicPlatformConfigView.as_view(), name='platform-config'),
    path('', include(router.urls)),
]
