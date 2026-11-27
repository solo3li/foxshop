from django.db import migrations


DEFAULT_SECTORS = [
    {
        'code': 'RESTAURANT',
        'name': 'مطاعم ومأكولات',
        'short_title': 'مطاعم',
        'search_placeholder': 'ابحث عن مطعم أو وجبة...',
        'icon_name': 'UtensilsCrossed',
        'image_url': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&q=80',
        'sort_order': 1,
    },
    {
        'code': 'SUPERMARKET',
        'name': 'سوبرماركت وبقالة',
        'short_title': 'سوبرماركت',
        'search_placeholder': 'ابحث عن منتجات البقالة والمشروبات...',
        'icon_name': 'ShoppingBasket',
        'image_url': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80',
        'sort_order': 2,
    },
    {
        'code': 'PHARMACY',
        'name': 'صيدليات وعناية',
        'short_title': 'صيدليات',
        'search_placeholder': 'ابحث عن دواء أو مستلزمات طبية...',
        'icon_name': 'Pill',
        'image_url': 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=300&q=80',
        'sort_order': 3,
    },
    {
        'code': 'BUTCHERY_VEG',
        'name': 'لحوم وخضار طازجة',
        'short_title': 'لحوم وخضار',
        'search_placeholder': 'ابحث عن لحوم طازجة أو خضروات...',
        'icon_name': 'Beef',
        'image_url': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&q=80',
        'sort_order': 4,
    },
    {
        'code': 'FLOWERS_GIFTS',
        'name': 'زهور وهدايا',
        'short_title': 'زهور وهدايا',
        'search_placeholder': 'ابحث عن باقات ورد أو هدايا...',
        'icon_name': 'Gift',
        'image_url': 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=300&q=80',
        'sort_order': 5,
    },
    {
        'code': 'GENERAL_RETAIL',
        'name': 'متاجر وتجزئة عامة',
        'short_title': 'تجزئة عامة',
        'search_placeholder': 'ابحث عن متاجر ومنتجات متنوعة...',
        'icon_name': 'ShoppingBag',
        'image_url': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80',
        'sort_order': 6,
    },
]


def seed_sectors(apps, schema_editor):
    StoreSector = apps.get_model('restaurants', 'StoreSector')
    Restaurant = apps.get_model('restaurants', 'Restaurant')

    code_to_sector = {}
    for item in DEFAULT_SECTORS:
        sector, _ = StoreSector.objects.get_or_create(
            code=item['code'],
            defaults={
                'name': item['name'],
                'short_title': item['short_title'],
                'search_placeholder': item['search_placeholder'],
                'icon_name': item['icon_name'],
                'image_url': item['image_url'],
                'sort_order': item['sort_order'],
                'is_active': True,
            },
        )
        code_to_sector[item['code']] = sector

    for rest in Restaurant.objects.filter(sector__isnull=True):
        matched = code_to_sector.get((rest.store_type or 'RESTAURANT').upper())
        if matched:
            rest.sector = matched
            rest.save(update_fields=['sector'])


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0010_storesector_alter_restaurant_store_type_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_sectors, reverse_seed),
    ]
