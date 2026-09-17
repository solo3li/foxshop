from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Address, PlatformSetting

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'phone_number', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
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
