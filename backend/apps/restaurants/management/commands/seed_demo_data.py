from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.payments.models import Currency
from apps.restaurants.models import Restaurant, OperatingHours, DeliveryZone
from apps.menus.models import MenuCategory, MenuItem

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds realistic demo restaurants and menu items for FoxShop'

    def handle(self, *args, **options):
        self.stdout.write("Starting FoxShop demo data seeding...")

        # 1. SAR Currency
        currency, _ = Currency.objects.get_or_create(
            code='SAR',
            defaults={'name': 'ريال سعودي', 'symbol': 'ر.س', 'is_active': True}
        )

        # 2. Merchant User
        merchant, _ = User.objects.get_or_create(
            username='merchant1',
            defaults={
                'first_name': 'سعد',
                'last_name': 'المطيري',
                'phone_number': '+966502222222',
                'role': 'MERCHANT'
            }
        )
        if not merchant.check_password('password123'):
            merchant.set_password('password123')
            merchant.save()

        # 3. Delivery Zone
        zone, _ = DeliveryZone.objects.get_or_create(
            name='منطقة شمال الرياض',
            defaults={
                'city': 'الرياض',
                'currency': currency,
                'base_delivery_fee': 10.00,
                'base_distance_km': 3.0,
                'per_km_fee': 2.00,
                'max_delivery_fee': 35.00,
                'is_active': True
            }
        )

        # 4. Restaurants Data
        restaurants_data = [
            {
                'name': 'بيتزا الثعلب',
                'description': 'أشهى أنواع البيتزا الإيطالية الطازجة والمخبوزة بالحطب',
                'rating': 4.8,
                'delivery_fee': 10.00,
                'estimated_prep_time_minutes': 25,
                'cover_image': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop',
                'categories': [
                    {
                        'name': 'البيتزا الأكثر مبيعاً',
                        'items': [
                            {
                                'name': 'بيتزا بيبروني خاصة',
                                'description': 'صلصة الطماطم الإيطالية، جبنة موزاريلا، وشريحة بيبروني غنية.',
                                'price': 45.00,
                                'image': 'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=400&auto=format&fit=crop'
                            },
                            {
                                'name': 'مارجريتا كلاسيك',
                                'description': 'صلصة الريحان الطازج، طماطم كرزية وجبنة موزاريلا فاخرة.',
                                'price': 38.00,
                                'image': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=400&auto=format&fit=crop'
                            }
                        ]
                    }
                ]
            },
            {
                'name': 'برجر تيلز',
                'description': 'برجر لحم بلدي فاخر مشوي على اللهب مع صلصات مبتكرة',
                'rating': 4.6,
                'delivery_fee': 12.00,
                'estimated_prep_time_minutes': 20,
                'cover_image': 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
                'categories': [
                    {
                        'name': 'سندويشات البرجر',
                        'items': [
                            {
                                'name': 'برجر فوكس كلاسيك',
                                'description': 'شريحة لحم بقر أنجوس، جبن شيدر ذائب، وصلصة الثعلب الخاصة.',
                                'price': 36.00,
                                'image': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=400&auto=format&fit=crop'
                            },
                            {
                                'name': 'دجاج مقرمش سبايسي',
                                'description': 'صدر دجاج مقرمش مع صوص سريراتشا مايونيز وخس طازج.',
                                'price': 32.00,
                                'image': 'https://images.unsplash.com/photo-1626082895617-2c6b490f23d4?q=80&w=400&auto=format&fit=crop'
                            }
                        ]
                    }
                ]
            },
            {
                'name': 'سوشي فوكس',
                'description': 'أطباق يابانية طازجة ومبتكرة من أمهر الطهاة',
                'rating': 4.9,
                'delivery_fee': 15.00,
                'estimated_prep_time_minutes': 35,
                'cover_image': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=600&auto=format&fit=crop',
                'categories': [
                    {
                        'name': 'لفائف السوشي',
                        'items': [
                            {
                                'name': 'رول السلمون المقرمش',
                                'description': 'سلمون طازج مع أفوكادو، خيار وفتات التيمبورا المقرمشة.',
                                'price': 52.00,
                                'image': 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=400&auto=format&fit=crop'
                            },
                            {
                                'name': 'تونا سبايسي رول',
                                'description': 'تونة فاخرة متبلة بمايونيز حار ورشة سمسم محمص.',
                                'price': 48.00,
                                'image': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=400&auto=format&fit=crop'
                            }
                        ]
                    }
                ]
            }
        ]

        for r_data in restaurants_data:
            restaurant, created = Restaurant.objects.get_or_create(
                name=r_data['name'],
                defaults={
                    'owner': merchant,
                    'description': r_data['description'],
                    'address_text': 'طريق الملك فهد، الرياض',
                    'latitude': 24.7136,
                    'longitude': 46.6753,
                    'delivery_radius_km': 25.0,
                    'currency': currency,
                    'delivery_fee': r_data['delivery_fee'],
                    'rating': r_data['rating'],
                    'rating_count': 120,
                    'estimated_prep_time_minutes': r_data['estimated_prep_time_minutes'],
                    'cover_image': r_data['cover_image'],
                    'is_active': True
                }
            )
            restaurant.delivery_zones.add(zone)

            # Create Categories & Items
            for cat_data in r_data['categories']:
                category, _ = MenuCategory.objects.get_or_create(
                    restaurant=restaurant,
                    name=cat_data['name'],
                    defaults={'order': 1}
                )
                for item_data in cat_data['items']:
                    MenuItem.objects.get_or_create(
                        category=category,
                        name=item_data['name'],
                        defaults={
                            'description': item_data['description'],
                            'base_price': item_data['price'],
                            'image': item_data['image'],
                            'is_available': True,
                            'is_popular': True
                        }
                    )
            self.stdout.write(self.style.SUCCESS(f"Seeded: {restaurant.name} (ID: {restaurant.id})"))

        self.stdout.write(self.style.SUCCESS("FoxShop demo data seeded successfully!"))
