from rest_framework import serializers
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


class MenuItemSerializer(serializers.ModelSerializer):
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'category', 'name', 'description', 'base_price', 'image', 'is_available', 'is_popular', 'modifier_groups']


class MenuCategoryWithItemsSerializer(serializers.ModelSerializer):
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = MenuCategory
        fields = ['id', 'name', 'order', 'items']
