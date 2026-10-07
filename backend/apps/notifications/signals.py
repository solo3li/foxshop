from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from apps.orders.models import Order
from .models import Notification

STATUS_NOTIFICATIONS = {
    Order.Status.PENDING: {
        'title': 'تم استلام طلبك #{order_number} ⏳',
        'message': 'طلبك من {restaurant_name} تم إرساله وبانتظار موافقة المطعم.',
    },
    Order.Status.CONFIRMED: {
        'title': 'تم تأكيد طلبك #{order_number} ✅',
        'message': 'وافق {restaurant_name} على طلبك وسيتم البدء في تحضيره فوراً.',
    },
    Order.Status.PREPARING: {
        'title': 'طلبك قيد التحضير الآن 👨‍🍳',
        'message': 'يقوم طهاة {restaurant_name} بإعداد طلبك الطازج واللذيذ.',
    },
    Order.Status.READY_FOR_PICKUP: {
        'title': 'طلبك جاهز للاستلام 📦',
        'message': 'طلبك جاهز في {restaurant_name} وبانتظار استلام الكابتن.',
    },
    Order.Status.ON_THE_WAY: {
        'title': 'الكابتن في طريقه إليك! 🛵',
        'message': 'الكابتن استلم طلبك من {restaurant_name} وهو في الطريق إلى عنوانك الآن.',
    },
    Order.Status.DELIVERED: {
        'title': 'تم توصيل طلبك بنجاح 🎉',
        'message': 'شكراً لطلبك من {restaurant_name}! بالهناء والشفاء ونتمنى لك وجبة شهية.',
    },
    Order.Status.CANCELLED: {
        'title': 'تم إلغاء طلبك #{order_number} ❌',
        'message': 'نأسف، تم إلغاء طلبك من {restaurant_name}. إذا تم الخصم فسيتم رد المبلغ لمحفظتك.',
    },
}

# Cache previous status to only notify on actual status transitions
_order_previous_status = {}

@receiver(pre_save, sender=Order)
def cache_order_previous_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            prev = Order.objects.get(pk=instance.pk)
            _order_previous_status[instance.pk] = prev.status
        except Order.DoesNotExist:
            _order_previous_status[instance.pk] = None

@receiver(post_save, sender=Order)
def notify_order_status_change(sender, instance, created, **kwargs):
    prev_status = _order_previous_status.pop(instance.pk, None)
    
    # Notify if newly created or status actually changed
    if created or (prev_status and prev_status != instance.status):
        template = STATUS_NOTIFICATIONS.get(instance.status)
        if template and instance.customer:
            restaurant_name = instance.restaurant.name if instance.restaurant else 'المطعم'
            title = template['title'].format(
                order_number=instance.order_number,
                restaurant_name=restaurant_name
            )
            message = template['message'].format(
                order_number=instance.order_number,
                restaurant_name=restaurant_name
            )

            Notification.objects.create(
                user=instance.customer,
                title=title,
                message=message,
                notification_type=Notification.NotificationType.ORDER,
                order=instance,
                data={
                    'order_id': str(instance.id),
                    'order_number': instance.order_number,
                    'status': instance.status,
                    'restaurant_name': restaurant_name
                }
            )
