from django.contrib import admin
from .models import Wallet, Transaction, Currency

@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'symbol', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('code', 'name', 'symbol')
    list_editable = ('is_active',)

class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    readonly_fields = ('amount', 'transaction_type', 'reference_id', 'description', 'created_at')

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance', 'currency', 'updated_at')
    search_fields = ('user__username',)
    inlines = [TransactionInline]

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('wallet', 'amount', 'transaction_type', 'reference_id', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('wallet__user__username', 'reference_id', 'description')

from .models import PayoutCycle, VendorPayout, DriverPayout

@admin.register(PayoutCycle)
class PayoutCycleAdmin(admin.ModelAdmin):
    list_display = ('cycle_code', 'start_date', 'end_date', 'is_closed', 'created_at')
    list_filter = ('is_closed',)
    search_fields = ('cycle_code',)

@admin.register(VendorPayout)
class VendorPayoutAdmin(admin.ModelAdmin):
    list_display = ('restaurant', 'cycle', 'orders_count', 'gross_sales', 'commission_amount', 'net_payout', 'status', 'paid_at')
    list_filter = ('status', 'cycle')
    search_fields = ('restaurant__name', 'bank_reference')
    actions = ['mark_as_approved', 'mark_as_paid']

    def mark_as_approved(self, request, queryset):
        queryset.update(status=VendorPayout.Status.APPROVED)
    mark_as_approved.short_description = "اعتماد التسويات المحددة للتحويل البنكي"

    def mark_as_paid(self, request, queryset):
        from django.utils import timezone
        queryset.update(status=VendorPayout.Status.PAID, paid_at=timezone.now())
    mark_as_paid.short_description = "تحديد كـ تم التحويل بنجاح"

@admin.register(DriverPayout)
class DriverPayoutAdmin(admin.ModelAdmin):
    list_display = ('driver', 'cycle', 'trips_count', 'delivery_fees_earned', 'cod_cash_collected', 'net_balance', 'status', 'paid_at')
    list_filter = ('status', 'cycle')
    search_fields = ('driver__username',)
    actions = ['mark_as_settled']

    def mark_as_settled(self, request, queryset):
        from django.utils import timezone
        queryset.update(status=DriverPayout.Status.SETTLED, paid_at=timezone.now())
    mark_as_settled.short_description = "تأكيد إتمام التسوية"
