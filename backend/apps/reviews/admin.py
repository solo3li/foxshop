from django.contrib import admin
from .models import OrderReview

@admin.register(OrderReview)
class OrderReviewAdmin(admin.ModelAdmin):
    list_display = ('order', 'restaurant', 'customer', 'food_rating', 'packaging_rating', 'driver_rating', 'created_at')
    list_filter = ('food_rating', 'packaging_rating', 'driver_rating', 'created_at')
    search_fields = ('order__order_number', 'restaurant__name', 'customer__username', 'restaurant_comment', 'driver_comment')
    readonly_fields = ('order', 'customer', 'restaurant', 'driver', 'created_at')
