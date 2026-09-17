from django.db import models
from django.conf import settings
import uuid

class Currency(models.Model):
    code = models.CharField(max_length=10, primary_key=True, verbose_name="رمز العملة (ISO)", help_text="مثال: SAR, EGP, AED, KWD, USD")
    name = models.CharField(max_length=50, verbose_name="اسم العملة", help_text="مثال: ريال سعودي، جنيه مصري")
    symbol = models.CharField(max_length=10, verbose_name="علامة العملة", help_text="مثال: ر.س، ج.م، د.إ، $")
    is_active = models.BooleanField(default=True, verbose_name="مفعلة للاستخدام في المنصة")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإضافة")

    class Meta:
        verbose_name = "عملة"
        verbose_name_plural = "العملات المعتمدة"
        ordering = ['code']

    def __str__(self):
        return f"{self.name} ({self.code}) - {self.symbol}"


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


class PayoutCycle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle_code = models.CharField(max_length=50, unique=True, verbose_name="كود الدورة الأسبوعية")
    start_date = models.DateField(verbose_name="بداية الفترة")
    end_date = models.DateField(verbose_name="نهاية الفترة")
    is_closed = models.BooleanField(default=False, verbose_name="تم إغلاق الدورة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "دورة تسوية أسبوعية"
        verbose_name_plural = "دورات التسويات الأسبوعية"
        ordering = ['-start_date']

    def __str__(self):
        return f"دورة {self.cycle_code} ({self.start_date} إلى {self.end_date})"


class VendorPayout(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'مسودة'
        APPROVED = 'APPROVED', 'معتمد للتحويل'
        PAID = 'PAID', 'تم التحويل بنجاح'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle = models.ForeignKey(PayoutCycle, on_delete=models.CASCADE, related_name='vendor_payouts', verbose_name="دورة التسوية")
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='payouts', verbose_name="المطعم")
    
    orders_count = models.PositiveIntegerField(default=0, verbose_name="عدد الطلبات المسلمة")
    gross_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="إجمالي مبيعات الوجبات")
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00, verbose_name="نسبة عمولة المنصة %")
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="مبلغ عمولة المنصة")
    net_payout = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="صافي المستحق للمطعم")
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name="حالة التسوية")
    bank_reference = models.CharField(max_length=100, blank=True, verbose_name="الرقم المرجعي للتحويل البنكي")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ وساعة التحويل")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "تسوية مطعم"
        verbose_name_plural = "تسويات المطاعم الأسبوعية"
        unique_together = ('cycle', 'restaurant')
        ordering = ['-created_at']

    def __str__(self):
        return f"تسوية {self.restaurant.name} ({self.net_payout} {self.restaurant.currency_id}) - {self.get_status_display()}"


class DriverPayout(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'معلق'
        SETTLED = 'SETTLED', 'تمت التسوية والتحويل'
        DEBT_OWED = 'DEBT_OWED', 'مطلوب توريد مديونية كاش'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle = models.ForeignKey(PayoutCycle, on_delete=models.CASCADE, related_name='driver_payouts', verbose_name="دورة التسوية")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payouts', verbose_name="الكابتن")
    
    trips_count = models.PositiveIntegerField(default=0, verbose_name="عدد مشاوير التوصيل")
    delivery_fees_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="أجور التوصيل المكتسبة")
    cod_cash_collected = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="مبالغ الكاش المحصلة (COD)")
    net_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="الرصيد الصافي")
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name="حالة التسوية")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ التسوية")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "تسوية كابتن"
        verbose_name_plural = "تسويات الكباتن الأسبوعية"
        unique_together = ('cycle', 'driver')
        ordering = ['-created_at']

    def __str__(self):
        return f"تسوية {self.driver.username} (صافي: {self.net_balance}) - {self.get_status_display()}"
