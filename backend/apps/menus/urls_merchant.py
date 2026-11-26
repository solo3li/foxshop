from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MerchantMenuItemViewSet,
    MerchantToggleItemAvailabilityView,
    MerchantMenuCategoryViewSet,
    MerchantMenuItemImageUploadView
)

router = DefaultRouter()
router.register('categories', MerchantMenuCategoryViewSet, basename='merchant-menu-category')
router.register('items', MerchantMenuItemViewSet, basename='merchant-menu-item')

urlpatterns = [
    path('items/upload-image/', MerchantMenuItemImageUploadView.as_view(), name='merchant-upload-menu-item-image'),
    path('items/<uuid:pk>/toggle-availability/', MerchantToggleItemAvailabilityView.as_view(), name='merchant-toggle-item-availability'),
    path('', include(router.urls)),
]
