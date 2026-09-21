from django.db import models
from django.conf import settings
import uuid
import random

class SupportTicket(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'مفتوحة (جديدة)'
        IN_PROGRESS = 'IN_PROGRESS', 'قيد المعالجة'
        WAITING_USER = 'WAITING_USER', 'بانتظار رد المستخدم'
        RESOLVED = 'RESOLVED', 'تم الحل'
        CLOSED = 'CLOSED', 'مغلقة'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'منخفضة'
        MEDIUM = 'MEDIUM', 'متوسطة'
        HIGH = 'HIGH', 'مرتفعة'
        CRITICAL = 'CRITICAL', 'حرجة / عاجلة'

    class Category(models.TextChoices):
        ORDER_ISSUE = 'ORDER_ISSUE', 'مشكلة في الطلب'
        DELIVERY_DELAY = 'DELIVERY_DELAY', 'تأخر التوصيل'
        FOOD_QUALITY = 'FOOD_QUALITY', 'جودة الطعام أو تلفه'
        PAYMENT_DISPUTE = 'PAYMENT_DISPUTE', 'نزاع مالي أو استرداد'
        DRIVER_ISSUE = 'DRIVER_ISSUE', 'مشكلة كابتن (عطل مركبة، إلخ)'
        MERCHANT_INQUIRY = 'MERCHANT_INQUIRY', 'استفسار مطعم أو تسوية'
        OTHER = 'OTHER', 'أخرى'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=50, unique=True, editable=False, verbose_name="رقم التذكرة")
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_tickets', verbose_name="صاحب التذكرة")
    user_role = models.CharField(max_length=20, verbose_name="صفة المستخدم")
    
    order = models.ForeignKey('orders.Order', null=True, blank=True, on_delete=models.SET_NULL, related_name='support_tickets', verbose_name="الطلب المرتبط")
    category = models.CharField(max_length=50, choices=Category.choices, default=Category.ORDER_ISSUE, verbose_name="تصنيف الشكوى")
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM, verbose_name="الأولوية")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, verbose_name="حالة التذكرة")
    
    subject = models.CharField(max_length=200, verbose_name="عنوان التذكرة")
    assigned_agent = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_tickets', verbose_name="موظف الدعم المسؤول")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تذكرة دعم فني"
        verbose_name_plural = "تذاكر الدعم الفني"
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            rand_suffix = random.randint(1000, 9999)
            self.ticket_number = f"TCK-{uuid.uuid4().hex[:4].upper()}-{rand_suffix}"
        if not self.user_role and self.user:
            self.user_role = getattr(self.user, 'role', 'CUSTOMER')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_number}: {self.subject} ({self.get_status_display()})"


class TicketMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages', verbose_name="التذكرة")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="المرسل")
    message_text = models.TextField(verbose_name="نص الرسالة")
    attachment = models.FileField(upload_to='support/attachments/', null=True, blank=True, verbose_name="مرفق")
    is_internal_note = models.BooleanField(default=False, verbose_name="ملاحظة داخلية (لفريق الدعم فقط)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرسال")

    class Meta:
        verbose_name = "رسالة شات الدعم"
        verbose_name_plural = "رسائل شات الدعم"
        ordering = ['created_at']

    @property
    def attachment_type(self):
        if not self.attachment:
            return None
        name = self.attachment.name.lower()
        if name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')):
            return 'image'
        if name.endswith(('.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.weba')) or 'voice_' in name:
            return 'audio'
        if name.endswith(('.mp4', '.webm', '.mov', '.mkv')):
            return 'video'
        return 'file'

    def __str__(self):
        return f"{self.sender.username}: {self.message_text[:30]}"
