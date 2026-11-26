from django.db import migrations, models


def unify_egp_currency(apps, schema_editor):
    Currency = apps.get_model('payments', 'Currency')
    Wallet = apps.get_model('payments', 'Wallet')

    # 1. Create or update EGP as active primary currency
    Currency.objects.update_or_create(
        code='EGP',
        defaults={
            'name': 'جنيه مصري',
            'symbol': 'ج.م',
            'is_active': True,
        }
    )

    # 2. Clean up rogue 'e.g' currency record
    Currency.objects.filter(code='e.g').delete()

    # 3. Deactivate SAR
    Currency.objects.filter(code='SAR').update(is_active=False)

    # 4. Migrate any existing Wallet records to EGP
    Wallet.objects.filter(currency__in=['SAR', 'e.g']).update(currency='EGP')


def reverse_unify_egp_currency(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_payoutcycle_driverpayout_vendorpayout'),
    ]

    operations = [
        migrations.RunPython(unify_egp_currency, reverse_code=reverse_unify_egp_currency),
        migrations.AlterField(
            model_name='wallet',
            name='currency',
            field=models.CharField(default='EGP', max_length=10),
        ),
    ]
