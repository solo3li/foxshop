from django.contrib import admin, messages
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import redirect, get_object_or_404
from .models import DriverProfile, PendingDriver, DeliveryTrip, DeliveryOffer
from apps.notifications.services import notify_driver_approved


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = (
        'get_full_name',
        'get_phone',
        'vehicle_type',
        'license_plate',
        'account_status_badge',
        'is_online',
        'is_busy',
        'total_delivered_orders',
        'rating',
        'cash_in_hand',
        'created_at'
    )
    list_filter = ('user__is_active', 'vehicle_type', 'is_online', 'is_busy')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'user__phone_number', 'license_plate')
    actions = ['approve_selected_drivers', 'deactivate_selected_drivers']

    def get_full_name(self, obj):
        name = obj.user.get_full_name()
        return name if name else obj.user.username
    get_full_name.short_description = 'اسم الكابتن'

    def get_phone(self, obj):
        return obj.user.phone_number or '-'
    get_phone.short_description = 'رقم الهاتف'

    def account_status_badge(self, obj):
        if obj.user.is_active:
            return format_html(
                '<span style="background-color: #10B981; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px;">🟢 معتمد ومفعل</span>'
            )
        return format_html(
            '<span style="background-color: #F59E0B; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px;">🟡 بانتظار موافقة الإدارة</span>'
        )
    account_status_badge.short_description = 'حالة الحساب'

    @admin.action(description='✅ تفعيل واعتماد الكباتن المحددين فورياً')
    def approve_selected_drivers(self, request, queryset):
        count = 0
        for profile in queryset:
            if not profile.user.is_active:
                profile.user.is_active = True
                profile.user.save(update_fields=['is_active'])
                notify_driver_approved(profile.user)
                count += 1
        if request:
            self.message_user(
                request,
                f"تم اعتماد وتفعيل حسابات {count} كابتن بنجاح وإشعارهم لحظياً 🎉",
                level=messages.SUCCESS
            )

    @admin.action(description='⛔ تعطيل / إيقاف الكباتن المحددين')
    def deactivate_selected_drivers(self, request, queryset):
        count = 0
        for profile in queryset:
            if profile.user.is_active:
                profile.user.is_active = False
                profile.user.save(update_fields=['is_active'])
                count += 1
        if request:
            self.message_user(
                request,
                f"تم تعطيل حسابات {count} كابتن بنجاح.",
                level=messages.WARNING
            )


@admin.register(PendingDriver)
class PendingDriverAdmin(admin.ModelAdmin):
    list_display = (
        'get_full_name',
        'get_phone',
        'vehicle_type',
        'license_plate',
        'created_at',
        'approval_badge',
        'approve_action_button',
    )
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'user__phone_number', 'license_plate')
    list_filter = ('vehicle_type',)
    actions = ['approve_selected_pending_drivers']

    def get_queryset(self, request):
        return super().get_queryset(request).filter(user__is_active=False, user__role='DRIVER').select_related('user')

    def get_full_name(self, obj):
        name = obj.user.get_full_name()
        return name if name else obj.user.username
    get_full_name.short_description = 'اسم الكابتن'

    def get_phone(self, obj):
        return obj.user.phone_number or '-'
    get_phone.short_description = 'رقم الهاتف'

    def approval_badge(self, obj):
        return format_html(
            '<span style="background-color: #F59E0B; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px;">⏳ بانتظار التدقيق</span>'
        )
    approval_badge.short_description = 'حالة الطلب'

    def approve_action_button(self, obj):
        return format_html(
            '<a class="button" style="background-color: #10B981; color: white; font-weight: bold; padding: 6px 14px; border-radius: 6px; text-decoration: none; display: inline-block;" href="approve/{}/">✅ اعتماد وتفعيل</a>',
            obj.pk
        )
    approve_action_button.short_description = 'إجراء فوري'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('approve/<int:profile_id>/', self.admin_site.admin_view(self.approve_single_driver), name='deliveries_pendingdriver_approve'),
        ]
        return custom_urls + urls

    def approve_single_driver(self, request, profile_id):
        profile = get_object_or_404(DriverProfile, pk=profile_id)
        user = profile.user
        user.is_active = True
        user.save(update_fields=['is_active'])
        notify_driver_approved(user)
        self.message_user(
            request,
            f"تم اعتماد وتفعيل حساب الكابتن ({user.get_full_name() or user.username}) بنجاح وإرسال الإشعار اللحظي له 🎉",
            level=messages.SUCCESS
        )
        return redirect('admin:deliveries_pendingdriver_changelist')

    @admin.action(description='✅ تفعيل واعتماد جميع الطلبات المحددة فورياً')
    def approve_selected_pending_drivers(self, request, queryset):
        count = 0
        for profile in queryset:
            profile.user.is_active = True
            profile.user.save(update_fields=['is_active'])
            notify_driver_approved(profile.user)
            count += 1
        if request:
            self.message_user(
                request,
                f"تم اعتماد وتفعيل {count} كابتن بنجاح! تم نقلهم إلى قائمة الكباتن المعتمدين.",
                level=messages.SUCCESS
            )


@admin.register(DeliveryTrip)
class DeliveryTripAdmin(admin.ModelAdmin):
    list_display = ('order', 'driver', 'status', 'delivery_otp', 'driver_earnings', 'distance_km', 'offered_at', 'completed_at')
    list_filter = ('status',)
    search_fields = ('order__order_number', 'driver__username', 'delivery_otp')
    readonly_fields = ('delivery_otp', 'offered_at', 'accepted_at', 'picked_up_at', 'completed_at')


@admin.register(DeliveryOffer)
class DeliveryOfferAdmin(admin.ModelAdmin):
    change_list_template = "admin/deliveries/deliveryoffer_change_list.html"
    list_display = (
        'get_order_number',
        'get_driver_info',
        'batch_number',
        'status_badge',
        'driver_earnings_display',
        'estimated_distance_display',
        'dispatch_type_badge',
        'response_time_display',
        'offered_at',
        'expires_at'
    )
    list_filter = ('status', 'is_manual', 'batch_number', 'offered_at')
    search_fields = ('order__order_number', 'driver__username', 'driver__phone_number')
    readonly_fields = (
        'id', 'order', 'driver', 'batch_number', 'status',
        'driver_earnings', 'estimated_distance_km', 'is_manual',
        'offered_at', 'expires_at', 'responded_at', 'response_time_seconds'
    )
    actions = ['cancel_selected_offers']

    def get_order_number(self, obj):
        return format_html(
            '<a href="/admin/orders/order/{}/change/"><strong>#{}</strong></a>',
            obj.order.id,
            obj.order.order_number
        )
    get_order_number.short_description = "رقم الطلب"

    def get_driver_info(self, obj):
        name = obj.driver.get_full_name() or obj.driver.username
        phone = obj.driver.phone_number or ""
        return format_html(
            '<strong>{}</strong><br><small style="color:#6b7280;">{}</small>',
            name, phone
        )
    get_driver_info.short_description = "الكابتن"

    def status_badge(self, obj):
        colors = {
            DeliveryOffer.Status.PENDING: ('#FEF3C7', '#B45309', '🟡 بانتظار الرد'),
            DeliveryOffer.Status.ACCEPTED: ('#DCFCE7', '#15803D', '🟢 مقبول'),
            DeliveryOffer.Status.REJECTED: ('#FEE2E2', '#B91C1C', '🔴 مرفوض يدوياً'),
            DeliveryOffer.Status.TIMED_OUT: ('#F3F4F6', '#4B5563', '⏱️ انتهت المهلة'),
            DeliveryOffer.Status.EXPIRED: ('#E0F2FE', '#0369A1', '💨 سبقه كابتن آخر'),
            DeliveryOffer.Status.REVOKED: ('#F1F5F9', '#64748B', '🚫 ملغي / مسحوب'),
        }
        bg, text, label = colors.get(obj.status, ('#F3F4F6', '#1F2937', obj.get_status_display()))
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px;">{}</span>',
            bg, text, label
        )
    status_badge.short_description = "حالة العرض"

    def driver_earnings_display(self, obj):
        return f"{obj.driver_earnings} ر.س"
    driver_earnings_display.short_description = "الأرباح"

    def estimated_distance_display(self, obj):
        return f"{obj.estimated_distance_km} كم"
    estimated_distance_display.short_description = "المسافة"

    def dispatch_type_badge(self, obj):
        if obj.is_manual:
            return format_html('<span style="color: #7C3AED; font-weight: bold;">👤 يدوي من الإدارة</span>')
        return format_html('<span style="color: #2563EB; font-weight: bold;">🤖 بث آلي</span>')
    dispatch_type_badge.short_description = "نوع التعيين"

    def response_time_display(self, obj):
        if obj.response_time_seconds is not None:
            return f"{obj.response_time_seconds} ثانية"
        return "-"
    response_time_display.short_description = "سرعة الرد"

    @admin.action(description="🚫 سحب / إلغاء العروض المعلقة المحددة")
    def cancel_selected_offers(self, request, queryset):
        count = queryset.filter(status=DeliveryOffer.Status.PENDING).update(status=DeliveryOffer.Status.REVOKED)
        self.message_user(request, f"تم سحب وإلغاء {count} عرض معلق بنجاح.", level=messages.SUCCESS)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('manual-dispatch/', self.admin_site.admin_view(self.manual_dispatch_view), name='deliveries_deliveryoffer_manual_dispatch'),
        ]
        return custom_urls + urls

    def manual_dispatch_view(self, request):
        from apps.orders.models import Order
        from apps.accounts.models import User
        from .dispatch import send_manual_offer_to_drivers
        from django.template.response import TemplateResponse

        if request.method == 'POST':
            order_id = request.POST.get('order_id')
            driver_ids = request.POST.getlist('driver_ids')
            timeout_seconds = int(request.POST.get('timeout_seconds', 60))

            if not order_id or not driver_ids:
                self.message_user(request, "يرجى تحديد الطلب واختيار كابتن واحد على الأقل.", level=messages.ERROR)
            else:
                try:
                    order = Order.objects.get(id=order_id)
                    drivers = User.objects.filter(id__in=driver_ids)
                    offers = send_manual_offer_to_drivers(order=order, drivers=drivers, timeout_seconds=timeout_seconds)
                    self.message_user(
                        request,
                        f"تم إرسال العرض اليدوي بنجاح للطلب #{order.order_number} إلى {len(offers)} كابتن وإشعارهم لحظياً على تطبيقاتهم 🚀",
                        level=messages.SUCCESS
                    )
                    return redirect('admin:deliveries_deliveryoffer_changelist')
                except Exception as e:
                    self.message_user(request, f"حدث خطأ أثناء إرسال العرض: {e}", level=messages.ERROR)

        active_orders = Order.objects.filter(
            status__in=[Order.Status.CONFIRMED, Order.Status.PREPARING, Order.Status.READY_FOR_PICKUP]
        ).select_related('restaurant').order_by('-created_at')

        drivers = User.objects.filter(role='DRIVER', is_active=True).select_related('driver_profile').order_by('-driver_profile__is_online', 'username')

        context = {
            **self.admin_site.each_context(request),
            'title': 'إرسال عرض توصيل يدوي للكباتن',
            'active_orders': active_orders,
            'drivers': drivers,
            'selected_order_id': request.GET.get('order_id', ''),
        }
        return TemplateResponse(request, 'admin/deliveries/manual_dispatch.html', context)
