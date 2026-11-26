from django.db import migrations, models


def migrate_orders_to_egp(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    Order.objects.filter(currency__in=['SAR', 'e.g']).update(currency='EGP')


def reverse_migrate_orders_to_egp(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_order_coupon_order_coupon_code_and_more'),
    ]

    operations = [
        migrations.RunPython(
            migrate_orders_to_egp,
            reverse_code=reverse_migrate_orders_to_egp,
        ),
        migrations.AlterField(
            model_name='order',
            name='currency',
            field=models.CharField(default='EGP', max_length=10),
        ),
    ]
