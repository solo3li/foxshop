from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI / Swagger Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Shared Auth & Platform Configuration
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/realtime/', include('apps.notifications.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
    path('api/v1/support/', include('apps.support.urls')),

    # Role-Based APIs
    path('api/v1/customer/', include([
        path('restaurants/', include('apps.restaurants.urls_customer')),
        path('menus/', include('apps.menus.urls_customer')),
        path('orders/', include('apps.orders.urls_customer')),
        path('promotions/', include('apps.promotions.urls_customer')),
        path('payments/', include('apps.payments.urls_customer')),
    ])),

    path('api/v1/merchant/', include([
        path('restaurants/', include('apps.restaurants.urls_merchant')),
        path('menus/', include('apps.menus.urls_merchant')),
        path('orders/', include('apps.orders.urls_merchant')),
    ])),

    path('api/v1/driver/', include([
        path('deliveries/', include('apps.deliveries.urls_driver')),
    ])),
]

# Static and media files serving fallback
from django.conf import settings
from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
