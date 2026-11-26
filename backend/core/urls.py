from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from apps.restaurants.views import CustomerSearchView

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI / Swagger Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Shared Auth & Platform Configuration
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/realtime/', include('apps.notifications.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
    path('api/v1/support/', include('apps.support.urls')),

    # Role-Based APIs
    path('api/v1/customer/', include([
        path('search/', CustomerSearchView.as_view(), name='customer-unified-search'),
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
        path('promotions/', include('apps.promotions.urls_merchant')),
        path('settlements/', include('apps.deliveries.urls_merchant_settlement')),
    ])),

    path('api/v1/driver/', include([
        path('deliveries/', include('apps.deliveries.urls_driver')),
        path('', include('apps.deliveries.urls_driver')),
    ])),

    path('api/v1/supervisor/', include('apps.deliveries.urls_supervisor')),
    path('api/v1/deliveries/supervisor/', include('apps.deliveries.urls_supervisor')),
]

# Inngest Background Tasks Endpoint
try:
    import inngest.django
    from core.inngest_client import inngest_client
    from apps.deliveries.inngest_functions import delivery_inngest_functions
    from apps.payments.inngest_functions import payment_inngest_functions
    from django.views.decorators.csrf import csrf_exempt
    pattern = inngest.django.serve(inngest_client, functions=delivery_inngest_functions + payment_inngest_functions)
    orig_cb = pattern.callback
    @csrf_exempt
    def debug_inngest_cb(request, *args, **kwargs):
        resp = orig_cb(request, *args, **kwargs)
        if getattr(resp, 'status_code', 200) >= 400:
            print(f"=== INNGEST VIEW ERROR ===", flush=True)
            print(f"status: {resp.status_code}", flush=True)
            print(f"body: {resp.content.decode('utf-8', errors='ignore')}", flush=True)
        return resp
    pattern.callback = debug_inngest_cb
    urlpatterns.append(pattern)
except Exception as e:
    import traceback
    traceback.print_exc()


# Static and media files serving fallback
from django.conf import settings
from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
