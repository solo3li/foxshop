from django.urls import path
from .views_settlement import (
    MerchantSettlementsListView,
    MerchantPendingSettlementsView,
    MerchantCreateSettlementOTPView
)

urlpatterns = [
    path('', MerchantSettlementsListView.as_view(), name='merchant-settlements-list'),
    path('pending/', MerchantPendingSettlementsView.as_view(), name='merchant-settlements-pending'),
    path('create/', MerchantCreateSettlementOTPView.as_view(), name='merchant-settlements-create'),
]
