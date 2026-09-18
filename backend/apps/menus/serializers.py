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


def _clean_image_url(val):
    if not val:
        return val
    if '/media/http' in val:
        import urllib.parse
        idx = val.find('/media/http')
        unquoted = urllib.parse.unquote(val[idx + len('/media/'):])
        if unquoted.startswith('https:/') and not unquoted.startswith('https://'):
            return unquoted.replace('https:/', 'https://', 1)
        if unquoted.startswith('http:/') and not unquoted.startswith('http://'):
            return unquoted.replace('http:/', 'http://', 1)
        return unquoted
    return val


class MenuItemSerializer(serializers.ModelSerializer):
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'category', 'name', 'description', 'base_price', 'image', 'is_available', 'is_popular', 'modifier_groups']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['image'] = _clean_image_url(ret.get('image'))
        return ret


class MenuCategoryWithItemsSerializer(serializers.ModelSerializer):
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = MenuCategory
        fields = ['id', 'name', 'order', 'items']
