from django.contrib import admin
from .models import Restaurant, DeliveryZone, OperatingHours

class OperatingHoursInline(admin.TabularInline):
    model = OperatingHours
    extra = 7

@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'currency', 'base_delivery_fee', 'is_active', 'created_at')
    list_filter = ('city', 'currency', 'is_active')
    search_fields = ('name', 'city')

@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'currency', 'delivery_fee', 'delivery_radius_km', 'rating', 'is_active', 'is_busy')
    list_filter = ('currency', 'is_active', 'is_busy')
    search_fields = ('name', 'owner__username')
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ('delivery_zones',)
    inlines = [OperatingHoursInline]
