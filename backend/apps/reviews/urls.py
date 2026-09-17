from django.urls import path
from .views import CustomerCreateOrderReviewView, RestaurantReviewsListView, MerchantReplyReviewView

urlpatterns = [
    path('customer/orders/<uuid:order_id>/review/', CustomerCreateOrderReviewView.as_view(), name='customer-create-review'),
    path('customer/restaurants/<uuid:restaurant_id>/reviews/', RestaurantReviewsListView.as_view(), name='customer-restaurant-reviews'),
    path('merchant/reviews/<uuid:id>/reply/', MerchantReplyReviewView.as_view(), name='merchant-reply-review'),
]
