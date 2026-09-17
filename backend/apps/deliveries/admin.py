from django.contrib import admin
from .models import DriverProfile, DeliveryTrip

@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle_type', 'is_online', 'is_busy', 'total_delivered_orders', 'rating', 'cash_in_hand')
    list_filter = ('vehicle_type', 'is_online', 'is_busy')
    search_fields = ('user__username', 'license_plate')

@admin.register(DeliveryTrip)
class DeliveryTripAdmin(admin.ModelAdmin):
    list_display = ('order', 'driver', 'status', 'delivery_otp', 'driver_earnings', 'distance_km', 'offered_at', 'completed_at')
    list_filter = ('status',)
    search_fields = ('order__order_number', 'driver__username', 'delivery_otp')
    readonly_fields = ('delivery_otp', 'offered_at', 'accepted_at', 'picked_up_at', 'completed_at')
