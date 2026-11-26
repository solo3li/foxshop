import csv
from decimal import Decimal
from django.contrib import admin, messages
from django.db import transaction as db_transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import Currency, DriverPayout, PayoutCycle, Transaction, VendorPayout, Wallet


def export_csv_helper(filename, headers, rows):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
    response.write('\ufeff')  # UTF-8 BOM for Arabic support in Excel
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'symbol', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('code', 'name', 'symbol')
    list_editable = ('is_active',)


class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    can_delete = False
    readonly_fields = ('id', 'amount', 'transaction_type', 'reference_id', 'description', 'created_at')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance_display', 'currency', 'updated_at', 'adjust_balance_btn')
    search_fields = ('user__username', 'user__phone_number', 'user__email')
    readonly_fields = ('user', 'balance', 'currency', 'created_at', 'updated_at')
    inlines = [TransactionInline]
    actions = ['quick_credit_50_bonus']

    def balance_display(self, obj):
        color = "#10b981" if obj.balance >= 0 else "#ef4444"
        return format_html('<strong style="color: {};">{} {}</strong>', color, obj.balance, obj.currency)
    balance_display.short_description = "الرصيد المتاح"

    def created_at(self, obj):
        return getattr(obj, 'created_at', None) or obj.updated_at
    created_at.short_description = "تاريخ الإنشاء"

    def adjust_balance_btn(self, obj):
        url = reverse('admin:payments_wallet_adjust_balance', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}" style="padding: 4px 10px; background-color: #2563eb; color: #fff; border-radius: 4px; font-weight: bold; font-size: 11px;">⚙️ تعديل / شحن الرصيد</a>',
            url
        )
    adjust_balance_btn.short_description = "إجراء مالي"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/adjust-balance/',
                self.admin_site.admin_view(self.adjust_balance_view),
                name='payments_wallet_adjust_balance'
            ),
        ]
        return custom_urls + urls

    def adjust_balance_view(self, request, object_id):
        wallet = get_object_or_404(Wallet, pk=object_id)
        if request.method == 'POST':
            action_type = request.POST.get('action_type')
            raw_amount = request.POST.get('amount')
            reference_id = request.POST.get('reference_id', '').strip()
            description = request.POST.get('description', '').strip()

            try:
                amount = Decimal(str(raw_amount))
                if amount <= Decimal('0.00'):
                    raise ValueError("المبلغ يجب أن يكون أكبر من صفر.")
            except Exception as e:
                self.message_user(request, f"خطأ في إدخال المبلغ: {e}", level=messages.ERROR)
                return render(request, 'admin/payments/adjust_balance.html', {
                    **self.admin_site.each_context(request),
                    'wallet': wallet,
                    'title': f'تعديل رصيد محفظة {wallet.user.username}',
                })

            with db_transaction.atomic():
                wallet_locked = Wallet.objects.select_for_update().get(pk=wallet.pk)
                if action_type == 'CREDIT_TOPUP':
                    wallet_locked.balance += amount
                    tx_type = Transaction.Types.TOPUP
                    ref = reference_id or f"ADMIN-TOPUP-{timezone.now().strftime('%Y%m%d%H%M')}"
                    desc = description or f"شحن يدوي معتمد من الإدارة بواسطة {request.user.username}"
                elif action_type == 'CREDIT_REFUND':
                    wallet_locked.balance += amount
                    tx_type = Transaction.Types.REFUND
                    ref = reference_id or f"ADMIN-REFUND-{timezone.now().strftime('%Y%m%d%H%M')}"
                    desc = description or f"استرداد نقدي معتمد من الإدارة بواسطة {request.user.username}"
                elif action_type == 'DEBIT_ADJUST':
                    wallet_locked.balance -= amount
                    tx_type = Transaction.Types.PAYOUT
                    ref = reference_id or f"ADMIN-DEBIT-{timezone.now().strftime('%Y%m%d%H%M')}"
                    desc = description or f"خصم / استقطاع مالي معتمد من الإدارة بواسطة {request.user.username}"
                else:
                    self.message_user(request, "نوع العملية غير صالح.", level=messages.ERROR)
                    return redirect('admin:payments_wallet_changelist')

                wallet_locked.save(update_fields=['balance', 'updated_at'])

                Transaction.objects.create(
                    wallet=wallet_locked,
                    amount=amount,
                    transaction_type=tx_type,
                    reference_id=ref,
                    description=desc
                )

            self.message_user(
                request,
                f"تم تنفيذ العملية بنجاح! الرصيد الجديد لمحفظة ({wallet.user.username}): {wallet_locked.balance} {wallet_locked.currency}",
                level=messages.SUCCESS
            )
            return redirect('admin:payments_wallet_changelist')

        context = {
            **self.admin_site.each_context(request),
            'wallet': wallet,
            'title': f'تعديل رصيد محفظة {wallet.user.username}',
        }
        return render(request, 'admin/payments/adjust_balance.html', context)

    @admin.action(description="🎁 منح مكافأة 50 ج.م للمحافظ المحددة مع قيد المعاملة")
    def quick_credit_50_bonus(self, request, queryset):
        bonus = Decimal('50.00')
        count = 0
        with db_transaction.atomic():
            for wallet in queryset:
                w_locked = Wallet.objects.select_for_update().get(pk=wallet.pk)
                w_locked.balance += bonus
                w_locked.save(update_fields=['balance', 'updated_at'])
                Transaction.objects.create(
                    wallet=w_locked,
                    amount=bonus,
                    transaction_type=Transaction.Types.TOPUP,
                    reference_id=f"BONUS-50-{timezone.now().strftime('%Y%m%d')}",
                    description=f"مكافأة ولاء / رصيد ترويجي معتمد من الإدارة ({request.user.username})"
                )
                count += 1
        self.message_user(request, f"تمت إضافة مكافأة 50 ج.م بنجاح لـ {count} محفظة مع قيد القيود المحاسبية.", level=messages.SUCCESS)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'wallet', 'amount', 'transaction_type', 'reference_id', 'description', 'created_at')
    list_filter = ('transaction_type', 'created_at')
    search_fields = ('wallet__user__username', 'reference_id', 'description')
    readonly_fields = ('id', 'wallet', 'amount', 'transaction_type', 'reference_id', 'description', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


def run_generate_weekly_payouts(modeladmin, request, queryset):
    from apps.payments.tasks import generate_weekly_payouts
    try:
        generate_weekly_payouts()
        modeladmin.message_user(request, "تم بنجاح تشغيل واحتساب دورة التسويات الأسبوعية لجميع المتاجر والكباتن 🎉", level=messages.SUCCESS)
    except Exception as e:
        modeladmin.message_user(request, f"حدث خطأ أثناء احتساب التسويات: {e}", level=messages.ERROR)
run_generate_weekly_payouts.short_description = "⚡ تشغيل وتحديث احتساب دورة التسويات الأسبوعية فورياً"


@admin.register(PayoutCycle)
class PayoutCycleAdmin(admin.ModelAdmin):
    list_display = ('cycle_code', 'start_date', 'end_date', 'is_closed', 'created_at')
    list_filter = ('is_closed',)
    search_fields = ('cycle_code',)
    actions = [run_generate_weekly_payouts]


@admin.register(VendorPayout)
class VendorPayoutAdmin(admin.ModelAdmin):
    list_display = (
        'restaurant', 'cycle', 'orders_count', 'gross_sales',
        'commission_rate', 'commission_amount', 'net_payout', 'status', 'paid_at'
    )
    list_filter = ('restaurant__store_type', 'status', 'cycle')
    search_fields = ('restaurant__name', 'bank_reference')
    readonly_fields = (
        'cycle', 'restaurant', 'orders_count', 'gross_sales',
        'commission_rate', 'commission_amount', 'net_payout', 'paid_at', 'created_at'
    )
    actions = ['mark_as_approved', 'mark_as_paid', 'export_vendor_payouts_csv', run_generate_weekly_payouts]

    def mark_as_approved(self, request, queryset):
        count = queryset.update(status=VendorPayout.Status.APPROVED)
        self.message_user(request, f"تم اعتماد {count} تسوية للتحويل البنكي.", level=messages.SUCCESS)
    mark_as_approved.short_description = "اعتماد التسويات المحددة للتحويل البنكي"

    def mark_as_paid(self, request, queryset):
        count = queryset.update(status=VendorPayout.Status.PAID, paid_at=timezone.now())
        self.message_user(request, f"تم تحديد {count} تسوية كـ تم التحويل بنجاح.", level=messages.SUCCESS)
    mark_as_paid.short_description = "تحديد كـ تم التحويل بنجاح"

    @admin.action(description="📥 تصدير تسويات المتاجر المحددة إلى ملف CSV")
    def export_vendor_payouts_csv(self, request, queryset):
        headers = [
            'كود دورة التسوية',
            'اسم المتجر / المطعم',
            'عدد الطلبات المسلمة',
            'إجمالي المبيعات (ج.م)',
            'نسبة عمولة المنصة (%)',
            'مبلغ عمولة المنصة (ج.م)',
            'صافي المستحق للمتجر (ج.م)',
            'حالة التسوية',
            'المرجع البنكي',
            'تاريخ التحويل',
        ]
        rows = []
        for vp in queryset.select_related('cycle', 'restaurant'):
            rows.append([
                vp.cycle.cycle_code,
                vp.restaurant.name,
                vp.orders_count,
                vp.gross_sales,
                vp.commission_rate,
                vp.commission_amount,
                vp.net_payout,
                vp.get_status_display(),
                vp.bank_reference or '-',
                vp.paid_at.strftime('%Y-%m-%d %H:%M') if vp.paid_at else '-',
            ])
        filename = f"vendor_payouts_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        return export_csv_helper(filename, headers, rows)


@admin.register(DriverPayout)
class DriverPayoutAdmin(admin.ModelAdmin):
    list_display = (
        'driver', 'cycle', 'trips_count', 'delivery_fees_earned',
        'cod_cash_collected', 'net_balance', 'status', 'paid_at'
    )
    list_filter = ('status', 'cycle')
    search_fields = ('driver__username', 'driver__phone_number')
    readonly_fields = (
        'cycle', 'driver', 'trips_count', 'delivery_fees_earned',
        'cod_cash_collected', 'net_balance', 'paid_at', 'created_at'
    )
    actions = ['mark_as_settled', 'export_driver_payouts_csv', run_generate_weekly_payouts]

    def mark_as_settled(self, request, queryset):
        count = queryset.update(status=DriverPayout.Status.SETTLED, paid_at=timezone.now())
        self.message_user(request, f"تم تأكيد تسوية {count} كابتن بنجاح.", level=messages.SUCCESS)
    mark_as_settled.short_description = "تأكيد إتمام التسوية"

    @admin.action(description="📥 تصدير تسويات الكباتن المحددة إلى ملف CSV")
    def export_driver_payouts_csv(self, request, queryset):
        headers = [
            'كود دورة التسوية',
            'اسم الكابتن',
            'رقم الهاتف',
            'عدد المشاوير المسلمة',
            'أجور التوصيل المكتسبة (ج.م)',
            'كاش COD المحصل (ج.م)',
            'الرصيد الصافي (ج.م)',
            'حالة التسوية',
            'تاريخ التسوية',
        ]
        rows = []
        for dp in queryset.select_related('cycle', 'driver'):
            rows.append([
                dp.cycle.cycle_code,
                dp.driver.get_full_name() or dp.driver.username,
                getattr(dp.driver, 'phone_number', '-'),
                dp.trips_count,
                dp.delivery_fees_earned,
                dp.cod_cash_collected,
                dp.net_balance,
                dp.get_status_display(),
                dp.paid_at.strftime('%Y-%m-%d %H:%M') if dp.paid_at else '-',
            ])
        filename = f"driver_payouts_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        return export_csv_helper(filename, headers, rows)
