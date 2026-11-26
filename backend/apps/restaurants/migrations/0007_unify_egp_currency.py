import django.db.models.deletion
from django.db import migrations, models


def migrate_restaurants_and_zones_to_egp(apps, schema_editor):
    Restaurant = apps.get_model('restaurants', 'Restaurant')
    DeliveryZone = apps.get_model('restaurants', 'DeliveryZone')

    DeliveryZone.objects.filter(currency_id__in=['SAR', 'e.g']).update(currency_id='EGP')
    Restaurant.objects.filter(currency_id__in=['SAR', 'e.g']).update(currency_id='EGP')


def reverse_migrate_restaurants_and_zones_to_egp(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0006_restaurant_delivery_mode_restaurant_store_type'),
        ('payments', '0004_unify_egp_currency'),
    ]

    operations = [
        migrations.RunPython(
            migrate_restaurants_and_zones_to_egp,
            reverse_code=reverse_migrate_restaurants_and_zones_to_egp,
        ),
        migrations.AlterField(
            model_name='deliveryzone',
            name='currency',
            field=models.ForeignKey(
                default='EGP',
                help_text='اختر العملة المعتمدة لهذه المنطقة من قائمة عملات المنصة',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='delivery_zones',
                to='payments.currency',
                verbose_name='العملة المعتمدة للمنطقة',
            ),
        ),
        migrations.AlterField(
            model_name='restaurant',
            name='currency',
            field=models.ForeignKey(
                default='EGP',
                help_text='العملة المعتمدة لأسعار المتجر',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='restaurants',
                to='payments.currency',
                verbose_name='عملة المتجر',
            ),
        ),
    ]
