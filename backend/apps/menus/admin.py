from django.contrib import admin
from .models import MenuCategory, MenuItem, ModifierGroup, Modifier

class ModifierInline(admin.TabularInline):
    model = Modifier
    extra = 2

@admin.register(ModifierGroup)
class ModifierGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'menu_item', 'is_required', 'min_selections', 'max_selections')
    inlines = [ModifierInline]

class ModifierGroupInline(admin.StackedInline):
    model = ModifierGroup
    extra = 1

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'pricing_unit', 'base_price', 'barcode', 'sku', 'stock_quantity', 'is_stock_tracked', 'is_available', 'is_popular')
    list_filter = ('category__restaurant__store_type', 'pricing_unit', 'is_stock_tracked', 'is_available', 'is_popular', 'category__restaurant')
    search_fields = ('name', 'description', 'barcode', 'sku')
    inlines = [ModifierGroupInline]

@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'restaurant', 'order')
    list_filter = ('restaurant__store_type', 'restaurant')
