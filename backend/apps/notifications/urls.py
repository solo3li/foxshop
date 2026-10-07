from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CentrifugoTokenView, NotificationViewSet

router = DefaultRouter()
router.register('', NotificationViewSet, basename='notification')

urlpatterns = [
    path('token/', CentrifugoTokenView.as_view(), name='realtime-token'),
    path('', include(router.urls)),
]
