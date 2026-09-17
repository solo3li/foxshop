from django.contrib import admin
from .models import Restaurant, DeliveryZone, OperatingHours

class OperatingHoursInline(admin.TabularInline):
    model = OperatingHours
    extra = 7

class DeliveryZoneInline(admin.StackedInline):
    model = DeliveryZone
    extra = 1

@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'currency', 'delivery_fee', 'delivery_radius_km', 'rating', 'is_active', 'is_busy')
    list_filter = ('currency', 'is_active', 'is_busy')
    search_fields = ('name', 'owner__username')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [OperatingHoursInline, DeliveryZoneInline]
