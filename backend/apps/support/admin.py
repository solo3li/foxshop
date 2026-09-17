from django.contrib import admin
from apps.support.models import SupportTicket, TicketMessage

class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 1
    fields = ('sender', 'message_text', 'attachment', 'is_internal_note', 'created_at')
    readonly_fields = ('created_at',)

@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = (
        'ticket_number', 'subject', 'user', 'user_role', 'category',
        'priority', 'status', 'assigned_agent', 'created_at'
    )
    list_filter = ('status', 'priority', 'category', 'user_role', 'created_at')
    search_fields = ('ticket_number', 'subject', 'user__username', 'user__phone_number')
    readonly_fields = ('ticket_number', 'created_at', 'updated_at')
    inlines = [TicketMessageInline]
    autocomplete_fields = ('user', 'assigned_agent', 'order')

    actions = ['mark_as_resolved', 'mark_as_closed']

    @admin.action(description="تحديد التذاكر المحددة كـ (تم الحل)")
    def mark_as_resolved(self, request, queryset):
        queryset.update(status=SupportTicket.Status.RESOLVED)

    @admin.action(description="إغلاق التذاكر المحددة")
    def mark_as_closed(self, request, queryset):
        queryset.update(status=SupportTicket.Status.CLOSED)

@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'sender', 'message_text_preview', 'is_internal_note', 'created_at')
    list_filter = ('is_internal_note', 'created_at')
    search_fields = ('ticket__ticket_number', 'message_text', 'sender__username')
    readonly_fields = ('created_at',)

    def message_text_preview(self, obj):
        return obj.message_text[:50]
    message_text_preview.short_description = "نص الرسالة"
