from django.contrib import admin
from .models import Order, OrderItem, OrderItemModifier, OrderStatusHistory

class OrderItemModifierInline(admin.TabularInline):
    model = OrderItemModifier
    extra = 0

class OrderItemInline(admin.StackedInline):
    model = OrderItem
    extra = 0

class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ('status', 'note', 'created_at')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'restaurant', 'status', 'total_amount', 'currency', 'payment_method', 'payment_status', 'created_at')
    list_filter = ('status', 'payment_method', 'payment_status', 'restaurant')
    search_fields = ('order_number', 'customer__username', 'restaurant__name')
    readonly_fields = ('order_number', 'created_at', 'updated_at')
    inlines = [OrderItemInline, OrderStatusHistoryInline]
