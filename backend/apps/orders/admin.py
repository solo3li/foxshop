from decimal import Decimal
from django.contrib import admin, messages
from django.db import transaction as db_transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from apps.deliveries.models import DeliveryTrip
from apps.payments.models import Transaction, Wallet
from .models import Order, OrderItem, OrderItemModifier, OrderStatusHistory


class OrderItemInline(admin.StackedInline):
    model = OrderItem
    extra = 0
    readonly_fields = (
        'item_name', 'unit_price', 'quantity', 'requested_weight',
        'actual_weight', 'is_weighted', 'total_price', 'get_modifiers_display'
    )
    fields = (
        ('item_name', 'unit_price', 'quantity', 'total_price'),
        ('is_weighted', 'requested_weight', 'actual_weight'),
        'get_modifiers_display'
    )

    def get_modifiers_display(self, obj):
        if not obj or not obj.pk:
            return "-"
        mods = obj.modifiers.all()
        if not mods.exists():
            return "بدون إضافات اختيارية"
        items = [f"• {m.modifier_name} (+{m.price_delta} ج.م)" for m in mods]
        return mark_safe("<br>".join(items))
    get_modifiers_display.short_description = "الإضافات والخيارات (Modifiers & Toppings)"


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    can_delete = False
    readonly_fields = ('status', 'note', 'created_at')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('order', 'status_badge', 'note', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('order__order_number', 'note')
    readonly_fields = ('id', 'order', 'status', 'note', 'created_at')

    def status_badge(self, obj):
        colors = {
            Order.Status.PENDING: '#f59e0b',
            Order.Status.CONFIRMED: '#3b82f6',
            Order.Status.PREPARING: '#8b5cf6',
            Order.Status.READY_FOR_PICKUP: '#06b6d4',
            Order.Status.ON_THE_WAY: '#f97316',
            Order.Status.DELIVERED: '#10b981',
            Order.Status.CANCELLED: '#ef4444',
        }
        color = colors.get(obj.status, '#64748b')
        status_dict = dict(Order.Status.choices)
        status_text = status_dict.get(obj.status, obj.status)
        return format_html(
            '<span style="background-color: {}; color: #fff; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: bold;">{}</span>',
            color, status_text
        )
    status_badge.short_description = "الحالة"

    def has_add_permission(self, request):
        return bool(request.user and request.user.is_superuser)

    def has_change_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)

    def has_delete_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_number', 'customer', 'restaurant', 'status_badge',
        'total_amount_display', 'discount_amount', 'coupon_code', 'currency',
        'is_weight_confirmed', 'is_settled_with_merchant', 'payment_method',
        'payment_status', 'created_at', 'receipt_button'
    )
    list_filter = (
        'status', 'restaurant__store_type', 'is_weight_confirmed', 'is_settled_with_merchant',
        'payment_method', 'payment_status', 'restaurant', 'created_at'
    )
    search_fields = ('order_number', 'customer__username', 'customer__phone_number', 'restaurant__name')
    readonly_fields = (
        'order_number', 'subtotal', 'delivery_fee', 'total_amount',
        'discount_amount', 'preauth_hold_amount', 'created_at', 'updated_at'
    )
    inlines = [OrderItemInline, OrderStatusHistoryInline]
    actions = [
        'manual_dispatch_action',
        'cancel_and_refund_to_wallet',
        'mark_cod_settled_with_merchant',
        'print_receipt_action'
    ]

    def status_badge(self, obj):
        colors = {
            Order.Status.PENDING: ('#fef3c7', '#b45309'),
            Order.Status.CONFIRMED: ('#dbeafe', '#1d4ed8'),
            Order.Status.PREPARING: ('#ede9fe', '#6d28d9'),
            Order.Status.READY_FOR_PICKUP: ('#cffafe', '#0e7490'),
            Order.Status.ON_THE_WAY: ('#ffedd5', '#c2410c'),
            Order.Status.DELIVERED: ('#d1fae5', '#047857'),
            Order.Status.CANCELLED: ('#fee2e2', '#b91c1c'),
        }
        bg, text = colors.get(obj.status, ('#f1f5f9', '#475569'))
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px;">{}</span>',
            bg, text, obj.get_status_display()
        )
    status_badge.short_description = "الحالة"

    def total_amount_display(self, obj):
        return format_html('<strong>{} {}</strong>', obj.total_amount, obj.currency)
    total_amount_display.short_description = "الإجمالي"

    def receipt_button(self, obj):
        url = reverse('admin:orders_order_print_receipt', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}" target="_blank" style="padding: 3px 8px; font-size: 11px; background-color: #ea580c; color: white; border-radius: 4px; font-weight: bold; text-decoration: none;">🖨️ فاتورة</a>',
            url
        )
    receipt_button.short_description = "الفاتورة"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/print-receipt/',
                self.admin_site.admin_view(self.print_receipt_view),
                name='orders_order_print_receipt'
            ),
        ]
        return custom_urls + urls

    def print_receipt_view(self, request, object_id):
        order = get_object_or_404(
            Order.objects.select_related('customer', 'restaurant', 'delivery_address').prefetch_related('items__modifiers'),
            pk=object_id
        )
        address_text = "محدد عبر الخريطة"
        if order.delivery_address and getattr(order.delivery_address, 'street', None):
            address_text = order.delivery_address.street
        elif isinstance(order.delivery_address_snapshot, dict):
            address_text = order.delivery_address_snapshot.get('street') or order.delivery_address_snapshot.get('address') or "محدد عبر الخريطة"

        return render(request, 'admin/orders/receipt.html', {
            'order': order,
            'address_text': address_text,
        })

    @admin.action(description='🎯 إرسال عرض توصيل يدوي للكباتن')
    def manual_dispatch_action(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "يرجى اختيار طلب واحد فقط لإرسال العرض اليدوي له.", level=messages.WARNING)
            return
        order = queryset.first()
        return redirect(f"/admin/deliveries/deliveryoffer/manual-dispatch/?order_id={order.id}")

    @admin.action(description='💰 إلغاء الطلب واسترداد القيمة لمحفظة العميل فورياً')
    def cancel_and_refund_to_wallet(self, request, queryset):
        refunded_count = 0
        skipped_count = 0

        with db_transaction.atomic():
            for order in queryset.select_for_update():
                if order.status == Order.Status.CANCELLED and order.payment_status == Order.PaymentStatus.REFUNDED:
                    skipped_count += 1
                    continue

                old_status = order.status
                order.status = Order.Status.CANCELLED
                order.payment_status = Order.PaymentStatus.REFUNDED
                order.cancellation_reason = f"إلغاء واسترداد مالي من المشرف/الإدارة ({request.user.username})"
                order.save(update_fields=['status', 'payment_status', 'cancellation_reason', 'updated_at'])

                # Cancel associated delivery trip if active
                DeliveryTrip.objects.filter(
                    order=order,
                    status__in=[
                        DeliveryTrip.Status.DISPATCHING,
                        DeliveryTrip.Status.OFFERED,
                        DeliveryTrip.Status.ACCEPTED,
                        DeliveryTrip.Status.ARRIVED_AT_STORE,
                        DeliveryTrip.Status.PICKED_UP,
                        DeliveryTrip.Status.ARRIVED_AT_CUSTOMER,
                        DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED,
                    ]
                ).update(status=DeliveryTrip.Status.CANCELLED)

                # Record status history
                OrderStatusHistory.objects.create(
                    order=order,
                    status=Order.Status.CANCELLED,
                    note=f"تم إلغاء الطلب وتحويل المبلغ ({order.total_amount} {order.currency}) لمحفظة العميل بواسطة الإدارة ({request.user.username})."
                )

                # Refund to customer wallet
                wallet, _ = Wallet.objects.select_for_update().get_or_create(
                    user=order.customer,
                    defaults={'currency': order.currency, 'balance': Decimal('0.00')}
                )
                wallet.balance += order.total_amount
                wallet.save(update_fields=['balance', 'updated_at'])

                Transaction.objects.create(
                    wallet=wallet,
                    amount=order.total_amount,
                    transaction_type=Transaction.Types.REFUND,
                    reference_id=order.order_number,
                    description=f"استرداد نقدي فوري لقيمة الطلب #{order.order_number} الملغي من الإدارة"
                )
                refunded_count += 1

        if refunded_count > 0:
            self.message_user(
                request,
                f"تم بنجاح إلغاء {refunded_count} طلب واسترداد المبالغ إلى محافظ العملاء وقيدها في القيود المالية 🎉",
                level=messages.SUCCESS
            )
        if skipped_count > 0:
            self.message_user(
                request,
                f"تم تخطي {skipped_count} طلب لأنها ملغاة ومسترجعة مسبقاً.",
                level=messages.INFO
            )

    @admin.action(description='💵 تحديد الطلبات المحددة كـ تمت تسوية الكاش مع التاجر')
    def mark_cod_settled_with_merchant(self, request, queryset):
        count = queryset.update(is_settled_with_merchant=True, updated_at=timezone.now())
        self.message_user(request, f"تم بنجاح تحديد {count} طلب كـ تمت تسوية الكاش مع التاجر بنجاح.", level=messages.SUCCESS)

    @admin.action(description='🖨️ طباعة إيصال / فاتورة الطلب المحدد')
    def print_receipt_action(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "يرجى تحديد طلب واحد فقط للطباعة.", level=messages.WARNING)
            return
        order = queryset.first()
        return redirect(reverse('admin:orders_order_print_receipt', args=[order.pk]))
