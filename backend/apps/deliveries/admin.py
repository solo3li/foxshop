from django.contrib import admin, messages
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import redirect, get_object_or_404
from .models import DriverProfile, PendingDriver, DeliveryTrip
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
