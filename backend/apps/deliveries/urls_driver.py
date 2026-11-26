from django.urls import path
from .views import (
    DriverProfileView, DriverToggleOnlineView, DriverUpdateGPSView,
    DriverCurrentTripView, DriverAcceptTripView, DriverRejectTripView, DriverPickupOrderView,
    DriverVerifyOTPAndCompleteView, DriverShiftView, DriverTripsListView,
    DriverTripDetailView, DriverRouteView, DriverAnalyticsView,
    DriverOffersListView, DriverAcceptOfferView, DriverRejectOfferView,
    DriverWalletPayoutRequestView, DriverWalletCashDepositView, DriverWalletTransactionsView
)
from .views_settlement import (
    DriverPendingSettlementsView,
    DriverVerifySettlementOTPView
)

urlpatterns = [
    # Active Offers
    path('offers/', DriverOffersListView.as_view(), name='driver-offers-list'),
    path('offers/<uuid:id>/accept/', DriverAcceptOfferView.as_view(), name='driver-accept-offer'),
    path('offers/<uuid:id>/reject/', DriverRejectOfferView.as_view(), name='driver-reject-offer'),

    # Driver Wallet & Payouts
    path('wallet/payout-request/', DriverWalletPayoutRequestView.as_view(), name='driver-wallet-payout-request'),
    path('wallet/cash-deposit/', DriverWalletCashDepositView.as_view(), name='driver-wallet-cash-deposit'),
    path('wallet/transactions/', DriverWalletTransactionsView.as_view(), name='driver-wallet-transactions'),

    # Shift Settlements
    path('settlement/pending/', DriverPendingSettlementsView.as_view(), name='driver-settlement-pending'),
    path('settlements/pending/', DriverPendingSettlementsView.as_view(), name='driver-settlements-pending'),
    path('settlement/verify-otp/', DriverVerifySettlementOTPView.as_view(), name='driver-settlement-verify-otp'),
    path('settlements/verify-otp/', DriverVerifySettlementOTPView.as_view(), name='driver-settlements-verify-otp'),


    path('profile/', DriverProfileView.as_view(), name='driver-profile'),
    path('toggle-online/', DriverToggleOnlineView.as_view(), name='driver-toggle-online'),
    path('shift/', DriverShiftView.as_view(), name='driver-shift'),
    path('gps/', DriverUpdateGPSView.as_view(), name='driver-update-gps'),
    path('current-trip/', DriverCurrentTripView.as_view(), name='driver-current-trip'),
    path('trips/', DriverTripsListView.as_view(), name='driver-trips-list'),
    path('trips/<uuid:id>/', DriverTripDetailView.as_view(), name='driver-trip-detail'),
    path('trips/<uuid:id>/accept/', DriverAcceptTripView.as_view(), name='driver-accept-trip'),
    path('trips/<uuid:id>/reject/', DriverRejectTripView.as_view(), name='driver-reject-trip'),
    path('trips/<uuid:id>/pickup/', DriverPickupOrderView.as_view(), name='driver-pickup-trip'),
    path('trips/<uuid:id>/verify-otp/', DriverVerifyOTPAndCompleteView.as_view(), name='driver-verify-otp'),
    path('trips/<uuid:id>/route/', DriverRouteView.as_view(), name='driver-trip-route'),
    path('analytics/', DriverAnalyticsView.as_view(), name='driver-analytics'),
]
