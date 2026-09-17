from django.urls import path
from .views import (
    DriverProfileView, DriverToggleOnlineView, DriverUpdateGPSView,
    DriverCurrentTripView, DriverAcceptTripView, DriverRejectTripView, DriverPickupOrderView,
    DriverVerifyOTPAndCompleteView
)

urlpatterns = [
    path('profile/', DriverProfileView.as_view(), name='driver-profile'),
    path('toggle-online/', DriverToggleOnlineView.as_view(), name='driver-toggle-online'),
    path('gps/', DriverUpdateGPSView.as_view(), name='driver-update-gps'),
    path('current-trip/', DriverCurrentTripView.as_view(), name='driver-current-trip'),
    path('trips/<uuid:id>/accept/', DriverAcceptTripView.as_view(), name='driver-accept-trip'),
    path('trips/<uuid:id>/reject/', DriverRejectTripView.as_view(), name='driver-reject-trip'),
    path('trips/<uuid:id>/pickup/', DriverPickupOrderView.as_view(), name='driver-pickup-trip'),
    path('trips/<uuid:id>/verify-otp/', DriverVerifyOTPAndCompleteView.as_view(), name='driver-verify-otp'),
]
