from django.urls import path
from .views import CustomerWalletView, CustomerTopUpWalletView

urlpatterns = [
    path('wallet/', CustomerWalletView.as_view(), name='customer-wallet'),
    path('wallet/topup/', CustomerTopUpWalletView.as_view(), name='customer-wallet-topup'),
]
