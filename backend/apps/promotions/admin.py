from django.contrib import admin
from .models import Coupon, CouponUsage


class CouponUsageInline(admin.TabularInline):
    model = CouponUsage
    extra = 0
    can_delete = False
    readonly_fields = ('user', 'order', 'discount_applied', 'used_at')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'discount_type', 'discount_value', 'funded_by',
        'restaurant', 'min_order_amount', 'first_order_only',
        'is_active', 'valid_from', 'valid_to'
    )
    list_filter = ('discount_type', 'funded_by', 'first_order_only', 'is_active')
    search_fields = ('code', 'restaurant__name')
    inlines = [CouponUsageInline]


@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ('id', 'coupon', 'user', 'order', 'discount_applied', 'used_at')
    list_filter = ('coupon__discount_type', 'coupon__funded_by', 'used_at')
    search_fields = ('coupon__code', 'user__username', 'order__order_number')
    readonly_fields = ('id', 'coupon', 'user', 'order', 'discount_applied', 'used_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
