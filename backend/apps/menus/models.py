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
        verbose_name = "تصنيف القائمة"
        verbose_name_plural = "تصنيفات القوائم"

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"


class MenuItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=200, verbose_name="اسم الوجبة / الصنف")
    description = models.TextField(blank=True, verbose_name="الوصف والمكونات")
    base_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر الأساسي")
    image = models.ImageField(upload_to='menu_items/', null=True, blank=True)
    is_available = models.BooleanField(default=True, verbose_name="متوفر للطلب (Item 86'ing)")
    is_popular = models.BooleanField(default=False, verbose_name="مميز / الأكثر طلباً")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.base_price} {self.category.restaurant.currency})"


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
