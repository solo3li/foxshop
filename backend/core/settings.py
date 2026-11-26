import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'foxshop-dev-secret-key-change-in-prod-2026')
DEBUG = os.getenv('DEBUG', '1') == '1'

ALLOWED_HOSTS = ['*']

CSRF_TRUSTED_ORIGINS = [
    'https://foxshop.169.58.32.179.nip.io',
    'http://foxshop.169.58.32.179.nip.io',
    'http://*.nip.io',
    'https://*.nip.io',
    'http://localhost',
    'http://localhost:8000',
    'http://localhost:8100',
    'http://localhost:8180',
    'http://127.0.0.1',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:8100',
    'http://127.0.0.1:8180',
    'http://169.58.32.179',
    'http://169.58.32.179:8180',
    'http://169.58.32.179:8100',
    'http://169.58.32.179:5173',
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Application definition
INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',

    # Domain Apps
    'apps.accounts',
    'apps.restaurants',
    'apps.menus',
    'apps.orders',
    'apps.deliveries',
    'apps.payments',
    'apps.promotions',
    'apps.notifications',
    'apps.reviews',
    'apps.support',
]

# GeoDjango (PostGIS) detection
try:
    from django.contrib.gis import geos
    INSTALLED_APPS.insert(5, 'django.contrib.gis')
    HAS_GIS = True
except Exception:
    HAS_GIS = False

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.PermissionsPolicyMiddleware',
]

# Disable COOP over plain HTTP to prevent Chrome untrustworthy origin warning
SECURE_CROSS_ORIGIN_OPENER_POLICY = None

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Database configuration: PostGIS on Docker / Postgres, with fallback for local dev
DATABASE_HOST = os.getenv('DATABASE_HOST')
if DATABASE_HOST and HAS_GIS:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': os.getenv('DATABASE_NAME', 'foxshop_db'),
            'USER': os.getenv('DATABASE_USER', 'foxshop_user'),
            'PASSWORD': os.getenv('DATABASE_PASSWORD', 'foxshop_password'),
            'HOST': DATABASE_HOST,
            'PORT': os.getenv('DATABASE_PORT', '5432'),
        }
    }
elif DATABASE_HOST:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DATABASE_NAME', 'foxshop_db'),
            'USER': os.getenv('DATABASE_USER', 'foxshop_user'),
            'PASSWORD': os.getenv('DATABASE_PASSWORD', 'foxshop_password'),
            'HOST': DATABASE_HOST,
            'PORT': os.getenv('DATABASE_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'accounts.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
]

LANGUAGE_CODE = 'ar'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Central Platform Currency Configuration
DEFAULT_CURRENCY = 'EGP'
DEFAULT_CURRENCY_SYMBOL = 'ج.م'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# MinIO / S3 Object Storage configuration
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
if AWS_ACCESS_KEY_ID:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME', 'foxshop-media')
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL', 'http://minio:9000')
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN')
    AWS_QUERYSTRING_AUTH = False

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'core.renderers.ORJSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Swagger / OpenAPI
SPECTACULAR_SETTINGS = {
    'TITLE': 'FoxShop Delivery API',
    'DESCRIPTION': 'Comprehensive REST API for Customer, Merchant, and Driver applications (Talabat-like ecosystem)',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# CORS
CORS_ALLOW_ALL_ORIGINS = True

from corsheaders.defaults import default_headers

CORS_ALLOW_HEADERS = list(default_headers) + [
    'cache-control',
    'pragma',
    'expires',
]

# Redis Cache with graceful fallback
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
try:
    import redis
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
except ImportError:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }




# Centrifugo Real-time settings
CENTRIFUGO_API_URL = os.getenv('CENTRIFUGO_API_URL', 'http://localhost:8001/api')
CENTRIFUGO_API_KEY = os.getenv('CENTRIFUGO_API_KEY', 'foxshop-super-secret-centrifugo-api-key-2026')
CENTRIFUGO_HMAC_SECRET = os.getenv('CENTRIFUGO_HMAC_SECRET', 'foxshop-super-secret-centrifugo-token-key-2026')

# Jazzmin Admin UI Configuration & FoxShop Branding
JAZZMIN_SETTINGS = {
    "site_title": "إدارة فوكس شوب | FoxShop Admin",
    "site_header": "فوكس شوب",
    "site_brand": "FoxShop 🦊",
    "site_logo": None,
    "login_logo": None,
    "login_logo_dark": None,
    "site_logo_classes": "img-circle",
    "site_icon": None,
    "welcome_sign": "مرحباً بك في لوحة تحكم وإدارة فوكس شوب 🦊",
    "copyright": "FoxShop Quick Commerce Ltd © 2026",
    "search_model": ["orders.Order", "accounts.User", "restaurants.Restaurant"],
    "user_avatar": None,
    "topmenu_links": [
        {"name": "الرئيسية", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "لوحة المشرف الميداني 📡", "url": "/supervisor/", "new_window": True},
        {"name": "بوابة التجار (تاجر) 🏪", "url": "/tager/", "new_window": True},
        {"name": "توثيق واجهات API 📋", "url": "/api/docs/", "new_window": True},
        {"model": "orders.Order"},
        {"model": "deliveries.DeliveryTrip"},
    ],
    "usermenu_links": [
        {"name": "المشرف الميداني", "url": "/supervisor/", "new_window": True, "icon": "fas fa-tachometer-alt"},
        {"model": "accounts.User"},
    ],
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": [],
    "hide_models": [],
    "order_with_respect_to": [
        "orders",
        "deliveries",
        "restaurants",
        "menus",
        "payments",
        "promotions",
        "accounts",
        "support",
        "reviews",
        "notifications",
        "admin",
        "auth",
    ],
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "auth.group": "fas fa-users",
        "admin.logentry": "fas fa-clipboard-list",
        "accounts": "fas fa-user-shield",
        "accounts.user": "fas fa-users",
        "accounts.address": "fas fa-map-marked-alt",
        "accounts.platformsetting": "fas fa-sliders-h",
        "restaurants": "fas fa-store-alt",
        "restaurants.restaurant": "fas fa-store",
        "restaurants.deliveryzone": "fas fa-draw-polygon",
        "menus": "fas fa-utensils",
        "menus.menuitem": "fas fa-hamburger",
        "menus.menucategory": "fas fa-th-list",
        "menus.modifiergroup": "fas fa-layer-group",
        "orders": "fas fa-shopping-bag",
        "orders.order": "fas fa-box-open",
        "orders.orderstatushistory": "fas fa-history",
        "deliveries": "fas fa-motorcycle",
        "deliveries.deliverytrip": "fas fa-route",
        "deliveries.driverprofile": "fas fa-id-card",
        "deliveries.pendingdriver": "fas fa-user-clock",
        "deliveries.deliveryoffer": "fas fa-broadcast-tower",
        "deliveries.shiftsettlement": "fas fa-file-invoice",
        "deliveries.drivercashsettlement": "fas fa-hand-holding-usd",
        "payments": "fas fa-wallet",
        "payments.wallet": "fas fa-wallet",
        "payments.transaction": "fas fa-receipt",
        "payments.vendorpayout": "fas fa-file-invoice-dollar",
        "payments.driverpayout": "fas fa-money-check-alt",
        "payments.payoutcycle": "fas fa-calendar-alt",
        "payments.currency": "fas fa-coins",
        "promotions": "fas fa-tags",
        "promotions.coupon": "fas fa-ticket-alt",
        "promotions.couponusage": "fas fa-percentage",
        "notifications": "fas fa-bell",
        "notifications.notification": "fas fa-bell",
        "reviews": "fas fa-star",
        "reviews.orderreview": "fas fa-star-half-alt",
        "support": "fas fa-headset",
        "support.supportticket": "fas fa-comments",
    },
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",
    "related_modal_active": False,
    "custom_css": "admin/css/custom_admin.css",
    "custom_js": "admin/js/custom_admin.js",
    "use_google_fonts_cdn": True,
    "show_ui_builder": False,
    "changeform_format": "horizontal_tabs",
    "changeform_format_overrides": {
        "auth.user": "collapsible",
        "accounts.user": "collapsible",
    },
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": False,
    "brand_small_text": False,
    "brand_colour": "navbar-dark",
    "accent": "accent-primary",
    "navbar": "navbar-dark navbar-primary",
    "no_navbar_border": False,
    "navbar_fixed": True,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": True,
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": False,
    "theme": "default",
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
}

