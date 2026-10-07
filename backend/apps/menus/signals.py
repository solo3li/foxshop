from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.restaurants.models import Restaurant
from apps.menus.models import MenuItem
from apps.menus.meilisearch_service import (
    sync_restaurant_to_meili,
    delete_restaurant_from_meili,
    sync_menu_item_to_meili,
    delete_menu_item_from_meili,
)

@receiver(post_save, sender=Restaurant)
def on_restaurant_save(sender, instance, **kwargs):
    sync_restaurant_to_meili(instance)

@receiver(post_delete, sender=Restaurant)
def on_restaurant_delete(sender, instance, **kwargs):
    delete_restaurant_from_meili(instance.id)

@receiver(post_save, sender=MenuItem)
def on_menu_item_save(sender, instance, **kwargs):
    sync_menu_item_to_meili(instance)

@receiver(post_delete, sender=MenuItem)
def on_menu_item_delete(sender, instance, **kwargs):
    delete_menu_item_from_meili(instance.id)
