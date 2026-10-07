import uuid
from django.db import models
from django.conf import settings

class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ORDER = 'order', 'تحديث طلب'
        PROMO = 'promo', 'عرض ترويجي'
        SYSTEM = 'system', 'إشعار نظام'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='المستخدم'
    )
    title = models.CharField(max_length=255, verbose_name='عنوان الإشعار')
    message = models.TextField(verbose_name='نص الإشعار')
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        verbose_name='نوع الإشعار'
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='الطلب المرتبط'
    )
    data = models.JSONField(default=dict, blank=True, verbose_name='بيانات إضافية')
    is_read = models.BooleanField(default=False, verbose_name='تمت القراءة')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')

    class Meta:
        verbose_name = 'إشعار'
        verbose_name_plural = 'الإشعارات'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title} ({'مقروء' if self.is_read else 'جديد'})"
