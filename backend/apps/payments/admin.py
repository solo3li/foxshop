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
