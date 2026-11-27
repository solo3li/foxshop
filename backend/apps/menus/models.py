from django.db import models
from apps.restaurants.models import Restaurant
import uuid

class MenuCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='menu_categories')
    name = models.CharField(max_length=100, verbose_name="اسم التصنيف")
    order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")

    class Meta:
        ordering = ['order', 'name']
        verbose_name = "تصنيف المنتجات"
        verbose_name_plural = "أقسام وتصنيفات المنتجات"

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"


class MenuItem(models.Model):
    class PricingUnit(models.TextChoices):
        PIECE = 'PIECE', 'قطعة / حبة'
        KG = 'KG', 'كيلوجرام'
        GRAM = 'GRAM', 'جرام'
        LITER = 'LITER', 'لتر'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=200, verbose_name="اسم المنتج / الصنف")
    description = models.TextField(blank=True, verbose_name="الوصف والمكونات")
    base_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر الأساسي")
    pricing_unit = models.CharField(
        max_length=20,
        choices=PricingUnit.choices,
        default=PricingUnit.PIECE,
        verbose_name="وحدة التسعير"
    )
    barcode = models.CharField(max_length=100, blank=True, null=True, db_index=True, verbose_name="باركود المنتج")
    sku = models.CharField(max_length=100, blank=True, null=True, db_index=True, verbose_name="رمز SKU")
    stock_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="كمية المخزون")
    is_stock_tracked = models.BooleanField(default=False, verbose_name="تتبع المخزون")
    image = models.ImageField(upload_to='menu_items/', null=True, blank=True)
    is_available = models.BooleanField(default=True, verbose_name="متوفر للطلب (Item 86'ing)")
    is_popular = models.BooleanField(default=False, verbose_name="مميز / الأكثر طلباً")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "منتج / صنف"
        verbose_name_plural = "المنتجات والأصناف"

    def save(self, *args, **kwargs):
        from core.image_utils import compress_model_images
        compress_model_images(self, [('image', (800, 800), 78)])
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.base_price} {self.category.restaurant.currency_id})"


class ModifierGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='modifier_groups')
    name = models.CharField(max_length=100, verbose_name="مجموعة الخيارات (مثل: الحجم، الإضافات)")
    is_required = models.BooleanField(default=False, verbose_name="إلزامي")
    min_selections = models.PositiveIntegerField(default=0)
    max_selections = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.menu_item.name} - {self.name}"


class Modifier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name='modifiers')
    name = models.CharField(max_length=100, verbose_name="اسم الخيار (مثل: حجم كبير، جبنة زيادة)")
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="فارق السعر")
    is_available = models.BooleanField(default=True, verbose_name="متوفر")

    def __str__(self):
        return f"{self.name} (+{self.price_delta})"
