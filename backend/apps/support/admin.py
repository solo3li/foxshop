from django.contrib import admin, messages
from django.urls import path, reverse
from django.shortcuts import get_object_or_404, render
from django.http import HttpResponseRedirect
from django.utils.html import format_html
from apps.support.models import SupportTicket, TicketMessage
from apps.support.services import broadcast_ticket_message


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    change_form_template = 'admin/support/supportticket/change_form.html'

    list_display = (
        'ticket_number', 'subject', 'user_badge', 'category',
        'priority_badge', 'status_badge', 'assigned_agent',
        'messages_count', 'chat_action', 'created_at'
    )
    list_filter = ('status', 'priority', 'category', 'user_role', 'created_at')
    search_fields = ('ticket_number', 'subject', 'user__username', 'user__phone_number')
    readonly_fields = ('ticket_number', 'created_at', 'updated_at')
    autocomplete_fields = ('user', 'assigned_agent', 'order')

    actions = [
        'assign_to_me_action',
        'mark_as_in_progress',
        'mark_as_waiting_user',
        'mark_as_resolved',
        'mark_as_closed',
    ]

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/chat/',
                self.admin_site.admin_view(self.ticket_chat_view),
                name='support_supportticket_chat',
            ),
            path(
                '<path:object_id>/reply/',
                self.admin_site.admin_view(self.ticket_reply_view),
                name='support_supportticket_reply',
            ),
            path(
                '<path:object_id>/action/',
                self.admin_site.admin_view(self.ticket_action_view),
                name='support_supportticket_action',
            ),
        ]
        return custom_urls + urls

    def ticket_chat_view(self, request, object_id):
        ticket = get_object_or_404(
            SupportTicket.objects.select_related('user', 'assigned_agent', 'order', 'order__restaurant'),
            pk=object_id
        )
        ticket_messages = ticket.messages.select_related('sender').all()

        context = {
            **self.admin_site.each_context(request),
            'title': f"غرفة محادثة التذكرة: {ticket.ticket_number}",
            'ticket': ticket,
            'ticket_messages': ticket_messages,
            'opts': self.model._meta,
        }
        return render(request, 'admin/support/supportticket/ticket_chat.html', context)

    def ticket_reply_view(self, request, object_id):
        return_to = request.POST.get('return_to', 'chat')
        redirect_url = (
            reverse('admin:support_supportticket_chat', args=[object_id])
            if return_to == 'chat'
            else reverse('admin:support_supportticket_change', args=[object_id])
        )

        if request.method != 'POST':
            return HttpResponseRedirect(redirect_url)

        ticket = get_object_or_404(SupportTicket, pk=object_id)
        message_text = request.POST.get('message_text', '').strip()
        reply_type = request.POST.get('reply_type', 'reply_waiting')
        attachment = request.FILES.get('attachment')

        if not message_text and not attachment:
            messages.error(request, 'عفواً، لا يمكن إرسال رد فارغ بدون نص أو مرفق.')
            return HttpResponseRedirect(redirect_url)

        is_internal = (reply_type == 'internal_note')

        # 1. Create message
        ticket_message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            message_text=message_text,
            attachment=attachment,
            is_internal_note=is_internal,
        )

        # 2. Update ticket status based on action
        if not is_internal:
            if reply_type == 'reply_resolve':
                ticket.status = SupportTicket.Status.RESOLVED
                status_msg = "تم إرسال الرد وتحديث حالة التذكرة إلى: (تم الحل) ✅"
            else:
                ticket.status = SupportTicket.Status.WAITING_USER
                status_msg = "تم إرسال الرد وتحديث حالة التذكرة إلى: (بانتظار رد المستخدم) ✉️"

            # Auto-assign if not assigned
            if not ticket.assigned_agent:
                ticket.assigned_agent = request.user

            ticket.save(update_fields=['status', 'assigned_agent', 'updated_at'])
            messages.success(request, status_msg)
        else:
            messages.success(request, "تمت إضافة الملاحظة الداخلية بنجاح (خاصة بفريق الدعم فقط) 🔒")

        # 3. Broadcast real-time event to Centrifugo
        try:
            broadcast_ticket_message(ticket_message)
        except Exception:
            pass

        return HttpResponseRedirect(redirect_url)

    def ticket_action_view(self, request, object_id):
        return_to = request.POST.get('return_to', 'chat')
        redirect_url = (
            reverse('admin:support_supportticket_chat', args=[object_id])
            if return_to == 'chat'
            else reverse('admin:support_supportticket_change', args=[object_id])
        )

        if request.method != 'POST':
            return HttpResponseRedirect(redirect_url)

        ticket = get_object_or_404(SupportTicket, pk=object_id)
        action = request.POST.get('action')

        if action == 'assign_to_me':
            ticket.assigned_agent = request.user
            if ticket.status == SupportTicket.Status.OPEN:
                ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.save(update_fields=['assigned_agent', 'status', 'updated_at'])
            messages.success(request, f"تم تعيين التذكرة إلى المشرف ({request.user.username}) بنجاح 👤")

        elif action == 'status_in_progress':
            ticket.status = SupportTicket.Status.IN_PROGRESS
            if not ticket.assigned_agent:
                ticket.assigned_agent = request.user
            ticket.save(update_fields=['status', 'assigned_agent', 'updated_at'])
            messages.success(request, "تم تغيير حالة التذكرة إلى: (قيد المعالجة) ⏳")

        elif action == 'status_waiting_user':
            ticket.status = SupportTicket.Status.WAITING_USER
            ticket.save(update_fields=['status', 'updated_at'])
            messages.success(request, "تم تغيير حالة التذكرة إلى: (بانتظار رد المستخدم) ✉️")

        elif action == 'status_resolved':
            ticket.status = SupportTicket.Status.RESOLVED
            ticket.save(update_fields=['status', 'updated_at'])
            messages.success(request, "تم تغيير حالة التذكرة إلى: (تم الحل) ✅")

        elif action == 'status_closed':
            ticket.status = SupportTicket.Status.CLOSED
            ticket.save(update_fields=['status', 'updated_at'])
            messages.success(request, "تم إغلاق التذكرة بنجاح 🔒")

        return HttpResponseRedirect(redirect_url)

    # --- Badges and Display Helpers ---

    def chat_action(self, obj):
        url = reverse('admin:support_supportticket_chat', args=[obj.pk])
        return format_html(
            '<a href="{}" class="button" style="display:inline-flex; align-items:center; gap:4px; background:#2563eb; color:#ffffff !important; border-radius:6px; padding:5px 12px; font-weight:800; font-size:12px; text-decoration:none !important; box-shadow: 0 1px 3px rgba(37,99,235,0.3);">'
            '💬 فتح الشات'
            '</a>',
            url
        )
    chat_action.short_description = "المحادثة والرد"

    def user_badge(self, obj):
        colors = {
            'CUSTOMER': '#e0f2fe; color: #0369a1',
            'DRIVER': '#dcfce7; color: #15803d',
            'MERCHANT': '#fef3c7; color: #b45309',
            'ADMIN': '#f3e8ff; color: #7e22ce',
        }
        style = colors.get(obj.user_role, '#f1f5f9; color: #475569')
        return format_html(
            '<div style="display:flex; align-items:center; gap:6px;">'
            '<strong>{}</strong>'
            '<span style="background:{}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">{}</span>'
            '</div>',
            obj.user.username,
            style,
            obj.user_role
        )
    user_badge.short_description = "صاحب التذكرة"

    def status_badge(self, obj):
        colors = {
            SupportTicket.Status.OPEN: '#dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe;',
            SupportTicket.Status.IN_PROGRESS: '#fef3c7; color: #b45309; border: 1px solid #fde68a;',
            SupportTicket.Status.WAITING_USER: '#f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff;',
            SupportTicket.Status.RESOLVED: '#dcfce7; color: #15803d; border: 1px solid #bbf7d0;',
            SupportTicket.Status.CLOSED: '#f1f5f9; color: #475569; border: 1px solid #e2e8f0;',
        }
        style = colors.get(obj.status, '#f1f5f9; color: #475569;')
        return format_html(
            '<span style="display:inline-block; padding:3px 10px; border-radius:14px; font-size:12px; font-weight:700; background:{}">{}</span>',
            style,
            obj.get_status_display()
        )
    status_badge.short_description = "حالة التذكرة"

    def priority_badge(self, obj):
        colors = {
            SupportTicket.Priority.CRITICAL: '#fee2e2; color: #b91c1c; border: 1px solid #fca5a5;',
            SupportTicket.Priority.HIGH: '#ffedd5; color: #c2410c; border: 1px solid #fed7aa;',
            SupportTicket.Priority.MEDIUM: '#e0f2fe; color: #0369a1; border: 1px solid #bae6fd;',
            SupportTicket.Priority.LOW: '#f1f5f9; color: #64748b; border: 1px solid #e2e8f0;',
        }
        style = colors.get(obj.priority, '#f1f5f9; color: #64748b;')
        return format_html(
            '<span style="display:inline-block; padding:3px 10px; border-radius:14px; font-size:12px; font-weight:700; background:{}">{}</span>',
            style,
            obj.get_priority_display()
        )
    priority_badge.short_description = "الأولوية"

    def messages_count(self, obj):
        count = obj.messages.count()
        return format_html('<span style="font-weight:700; font-size:13px;">💬 {}</span>', count)
    messages_count.short_description = "عدد الردود"

    # --- Bulk Actions ---

    @admin.action(description="تعيين التذاكر المحددة لي شخصياً")
    def assign_to_me_action(self, request, queryset):
        updated = queryset.update(assigned_agent=request.user)
        self.message_user(request, f"تم تعيين {updated} تذكرة إلى حسابك بنجاح.", messages.SUCCESS)

    @admin.action(description="تحويل حالة التذاكر المحددة إلى: (قيد المعالجة)")
    def mark_as_in_progress(self, request, queryset):
        updated = queryset.update(status=SupportTicket.Status.IN_PROGRESS)
        self.message_user(request, f"تم تحويل {updated} تذكرة إلى (قيد المعالجة).", messages.SUCCESS)

    @admin.action(description="تحويل حالة التذاكر المحددة إلى: (بانتظار رد المستخدم)")
    def mark_as_waiting_user(self, request, queryset):
        updated = queryset.update(status=SupportTicket.Status.WAITING_USER)
        self.message_user(request, f"تم تحويل {updated} تذكرة إلى (بانتظار رد المستخدم).", messages.SUCCESS)

    @admin.action(description="تحديد التذاكر المحددة كـ: (تم الحل)")
    def mark_as_resolved(self, request, queryset):
        updated = queryset.update(status=SupportTicket.Status.RESOLVED)
        self.message_user(request, f"تم تحديد {updated} تذكرة كـ (تم الحل).", messages.SUCCESS)

    @admin.action(description="إغلاق التذاكر المحددة نهائياً")
    def mark_as_closed(self, request, queryset):
        updated = queryset.update(status=SupportTicket.Status.CLOSED)
        self.message_user(request, f"تم إغلاق {updated} تذكرة بنجاح.", messages.SUCCESS)


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'sender', 'message_text_preview', 'is_internal_note', 'created_at')
    list_filter = ('is_internal_note', 'created_at')
    search_fields = ('ticket__ticket_number', 'message_text', 'sender__username')
    readonly_fields = ('created_at',)

    def message_text_preview(self, obj):
        return obj.message_text[:50]
    message_text_preview.short_description = "نص الرسالة"
