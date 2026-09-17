from django.db import models
from django.conf import settings
import uuid

class Wallet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="الرصيد المتاح")
    currency = models.CharField(max_length=10, default='SAR')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"محفظة {self.user.username} ({self.balance} {self.currency})"


class Transaction(models.Model):
    class Types(models.TextChoices):
        TOPUP = 'TOPUP', 'شحن رصيد'
        ORDER_PAYMENT = 'ORDER_PAYMENT', 'دفع قيمة طلب'
        REFUND = 'REFUND', 'استرداد نقدي فوري'
        PAYOUT = 'PAYOUT', 'تسوية وسحب أرباح'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=Types.choices)
    reference_id = models.CharField(max_length=100, blank=True, help_text="رقم العملية البنكية أو رقم الطلب")
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} ({self.wallet.user.username})"
