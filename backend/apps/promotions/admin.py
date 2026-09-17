from django.contrib import admin
from .models import Coupon, CouponUsage

class CouponUsageInline(admin.TabularInline):
    model = CouponUsage
    extra = 0
    readonly_fields = ('user', 'order_id', 'used_at')

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'min_order_amount', 'first_order_only', 'is_active', 'valid_from', 'valid_to')
    list_filter = ('discount_type', 'first_order_only', 'is_active')
    search_fields = ('code',)
    inlines = [CouponUsageInline]

@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ('coupon', 'user', 'order_id', 'used_at')
    search_fields = ('coupon__code', 'user__username')
