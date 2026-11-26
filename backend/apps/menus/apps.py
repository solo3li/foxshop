from django.apps import AppConfig

class MenusConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.menus'
    verbose_name = 'كتالوج المنتجات والمخزون'

    def ready(self):
        try:
            import apps.menus.signals
        except Exception:
            pass
