from rest_framework import serializers
from core.image_utils import build_imgproxy_url
from .models import MenuCategory, MenuItem, ModifierGroup, Modifier

class ModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modifier
        fields = ['id', 'name', 'price_delta', 'is_available']


class ModifierGroupSerializer(serializers.ModelSerializer):
    modifiers = ModifierSerializer(many=True, read_only=True)

    class Meta:
        model = ModifierGroup
        fields = ['id', 'name', 'is_required', 'min_selections', 'max_selections', 'modifiers']


class HybridImageField(serializers.ImageField):
    """
    Accepts both uploaded image files (Multipart/FormData)
    and valid URL/path strings (e.g. existing image path or external URL),
    or null/empty strings to clear.
    """
    def to_internal_value(self, data):
        if isinstance(data, str):
            data_clean = data.strip()
            if not data_clean or data_clean in ('null', 'undefined', 'None'):
                return None
            return data_clean
        return super().to_internal_value(data)


class MenuItemSerializer(serializers.ModelSerializer):
    image = HybridImageField(required=False, allow_null=True)
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)
    restaurant_id = serializers.UUIDField(source='category.restaurant.id', read_only=True)
    restaurant_name = serializers.CharField(source='category.restaurant.name', read_only=True)
    store_type = serializers.CharField(source='category.restaurant.store_type', read_only=True)
    currency = serializers.CharField(source='category.restaurant.currency_id', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'category', 'category_name', 'restaurant_id', 'restaurant_name',
            'store_type', 'currency', 'name', 'description', 'base_price', 'image',
            'pricing_unit', 'barcode', 'sku', 'stock_quantity', 'is_stock_tracked',
            'is_available', 'is_popular', 'modifier_groups'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['image'] = build_imgproxy_url(
            ret.get('image'),
            request=self.context.get('request'),
            width=500,
            height=500,
            quality=75,
        )
        return ret


class MenuCategorySerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = MenuCategory
        fields = ['id', 'restaurant', 'name', 'order', 'items_count']
        read_only_fields = ['id', 'restaurant', 'items_count']

    def get_items_count(self, obj):
        return obj.items.count()


class MenuCategoryWithItemsSerializer(serializers.ModelSerializer):
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = MenuCategory
        fields = ['id', 'name', 'order', 'items']
