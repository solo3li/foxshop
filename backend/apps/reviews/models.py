from django.db import models
from django.conf import settings
import uuid

class OrderReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField('orders.Order', on_delete=models.CASCADE, related_name='review', verbose_name="الطلب")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews', verbose_name="العميل")
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='reviews', verbose_name="المطعم")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='driver_reviews', verbose_name="الكابتن")

    # Restaurant Ratings
    food_rating = models.PositiveSmallIntegerField(
        choices=[(i, str(i)) for i in range(1, 6)],
        verbose_name="تقييم جودة الطعام (1-5)"
    )
    packaging_rating = models.PositiveSmallIntegerField(
        default=5,
        choices=[(i, str(i)) for i in range(1, 6)],
        verbose_name="تقييم التغليف والنظافة (1-5)"
    )
    restaurant_comment = models.TextField(blank=True, verbose_name="تعليق على المطعم")

    # Driver Ratings
    delivery_speed_rating = models.PositiveSmallIntegerField(
        null=True, blank=True,
        choices=[(i, str(i)) for i in range(1, 6)],
        verbose_name="سرعة التوصيل (1-5)"
    )
    driver_rating = models.PositiveSmallIntegerField(
        null=True, blank=True,
        choices=[(i, str(i)) for i in range(1, 6)],
        verbose_name="تقييم الكابتن وحسن التعامل (1-5)"
    )
    driver_comment = models.TextField(blank=True, verbose_name="تعليق على الكابتن")

    # Merchant Reply
    merchant_reply = models.TextField(blank=True, verbose_name="رد صاحب المطعم")
    merchant_replied_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الرد")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التقييم")

    class Meta:
        verbose_name = "تقييم الطلب"
        verbose_name_plural = "تقييمات الطلبات والمراجعات"
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.update_aggregate_ratings()

    def update_aggregate_ratings(self):
        # 1. Update Restaurant rating (average of food and packaging ratings)
        rest_stats = OrderReview.objects.filter(restaurant=self.restaurant).aggregate(
            avg_rating=models.Avg((models.F('food_rating') + models.F('packaging_rating')) / 2.0),
            total_count=models.Count('id')
        )
        if rest_stats['avg_rating'] is not None:
            self.restaurant.rating = round(float(rest_stats['avg_rating']), 2)
            self.restaurant.rating_count = rest_stats['total_count']
            self.restaurant.save(update_fields=['rating', 'rating_count'])

        # 2. Update Driver rating if applicable
        if self.driver and hasattr(self.driver, 'driver_profile'):
            driver_stats = OrderReview.objects.filter(driver=self.driver, driver_rating__isnull=False).aggregate(
                avg_rating=models.Avg('driver_rating')
            )
            if driver_stats['avg_rating'] is not None:
                profile = self.driver.driver_profile
                profile.rating = round(float(driver_stats['avg_rating']), 2)
                profile.save(update_fields=['rating'])

    def __str__(self):
        return f"تقييم طلب {self.order.order_number} ({self.food_rating}/5)"
