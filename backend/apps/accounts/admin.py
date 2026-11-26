from django.contrib import admin
from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, Address, PlatformSetting


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'phone_number', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username', 'first_name', 'last_name', 'email', 'phone_number')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('معلومات دور المنصة', {'fields': ('role', 'phone_number', 'avatar')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('معلومات دور المنصة', {'fields': ('role', 'phone_number', 'avatar')}),
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'street', 'is_default', 'created_at')
    search_fields = ('title', 'user__username', 'street')
    list_filter = ('is_default',)


@admin.register(PlatformSetting)
class PlatformSettingAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'default_search_radius_km', 'cod_max_ceiling', 'platform_commission_percent', 'updated_at')
    fieldsets = (
        ('مفاتيح Google Maps (إدخال يدوي)', {
            'description': 'قم بوضع مفتاح Google Maps هنا ليتم تطبيقه على كافة خدمات الخرائط والمسافات فوراً.',
            'fields': ('google_maps_server_key', 'google_maps_client_key')
        }),
        ('إعدادات المنصة الافتراضية', {
            'fields': ('default_search_radius_km', 'cod_max_ceiling', 'platform_commission_percent')
        }),
    )

    def has_add_permission(self, request):
        # Only allow 1 singleton instance
        if PlatformSetting.objects.exists():
            return False
        return True

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ('action_time', 'user', 'content_type', 'object_repr', 'action_flag_badge', 'change_message')
    list_filter = ('action_flag', 'content_type', 'action_time')
    search_fields = ('object_repr', 'change_message', 'user__username', 'user__email')
    date_hierarchy = 'action_time'
    readonly_fields = ('action_time', 'user', 'content_type', 'object_id', 'object_repr', 'action_flag', 'change_message')

    def action_flag_badge(self, obj):
        colors = {
            ADDITION: ('#d1fae5', '#047857', '🟢 إضافة'),
            CHANGE: ('#dbeafe', '#1d4ed8', '🔵 تعديل'),
            DELETION: ('#fee2e2', '#b91c1c', '🔴 حذف'),
        }
        bg, text, label = colors.get(obj.action_flag, ('#f1f5f9', '#475569', 'إجراء'))
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: bold;">{}</span>',
            bg, text, label
        )
    action_flag_badge.short_description = "نوع الإجراء"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
