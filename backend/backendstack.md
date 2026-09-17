# FoxShop Backend Architecture & Docker Stack Specification

وثيقة معمارية شاملة توثق هيكلية الـ Backend والخدمات المشغلة عبر **Docker** لتطبيق توصيل شبيه بـ (طلبات).

---

## 1. نظرة عامة على الـ Stack التقني

| المكون | التقنية المختارة | الدور المعماري |
| :--- | :--- | :--- |
| **API & Business Logic** | **Django + Gunicorn** (Python 3.12) | إدارة المستخدمين، المصادقة، المطاعم، القوائم، الطلبات، والمدفوعات. |
| **Reverse Proxy & SSL** | **Traefik v3** | البوابة الخارجية الوحيدة، الاكتشاف التلقائي للحاويات عبر Docker Labels، وإدارة شهادات Let's Encrypt. |
| **Real-time Server** | **Centrifugo v5** | إدارة اتصالات الـ WebSockets الحية لآلاف المستخدمين والكباتن باستهلاك موارد منخفض. |
| **Database** | **PostgreSQL 16 + PostGIS** | مستودع البيانات الدائم مع دعم الحسابات الجغرافية (نطاقات التوصيل والمسافات). |
| **Cache & Real-time Broker** | **Redis 7** | محرك Centrifugo الموزع، وسيط مهام Celery، والتخزين المؤقت لإحداثيات GPS الحية (GEOADD). |
| **Object Storage** | **MinIO (S3 Compatible)** | تخزين صور المطاعم والوجبات والمستندات محلياً وسحابياً عبر واجهة S3 معيارية. |
| **Async Task Workers** | **Celery + Celery Beat** | تنفيذ المهام المؤجلة والخلفية (مؤقتات قبول الطلب، إرسال Push Notifications، إلغاء الطلبات المتأخرة). |

---

## 2. خريطة الحاويات وشبكة التواصل الداخلية (Docker Topology & Networking)

جميع الحاويات تعمل خلف شبكة دوكر داخلية معزولة (`foxshop-network`)، والمنفذ الوحيد المعرض للخارج هو منفذ Traefik (`80` و `443`):

```text
                           [ React Native Client / Admin Dashboard ]
                                              │
                                       HTTPS (443) / WSS
                                              ▼
                        ┌──────────────────────────────────────────┐
                        │               Traefik v3                 │
                        │           (Ports: 80, 443)               │
                        └─────┬──────────────┬──────────────┬──────┘
                              │              │              │
           Host: api.foxshop  │ Host: ws...  │ Host: media..│
                              ▼              ▼              ▼
                     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                     │    Django    │ │  Centrifugo  │ │    MinIO     │
                     │  (Port 8000) │ │  (Port 8000) │ │  (Port 9000) │
                     └──────┬───────┘ └──────┬───────┘ └──────────────┘
                            │                │
                    HTTP API│(Publish events)│
                            ├────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      ┌─────────────────┐       ┌─────────────────┐
      │  PostGIS 16     │       │     Redis 7     │
      │  (Port 5432)    │       │   (Port 6379)   │
      └─────────────────┘       └────────┬────────┘
                                         │ Broker
                                ┌────────┴────────┐
                                ▼                 ▼
                         ┌─────────────┐   ┌─────────────┐
                         │Celery Worker│   │ Celery Beat │
                         └─────────────┘   └─────────────┘
```

---

## 3. تفاصيل المكونات والقرارات المعمارية

### أ. Traefik (بوابة الدخول و Reverse Proxy)
* **آلية العمل:** توجيه الـ Traffic بناءً على أسماء النطاقات (Domain Routers) عبر Docker Labels دون الحاجة لإعادة تشغيل الحاوية.
* **إعدادات الأمان:**
  * ربط مقبس دوكر بوضع القراءة فقط: `/var/run/docker.sock:ro`.
  * حماية لوحة تحكم Traefik Dashboard بـ BasicAuth أو قصرها على الشبكة المحلية.
* **دعم الـ WebSockets:** يعمل تلقائياً مع Centrifugo دون أي إعدادات Headers يدوية.

### ب. Centrifugo (خادم الاتصال اللحظي)
* **المصادقة (Auth):**
  * دجانجو يولد رمز اتصال مشفر (HMAC JWT Token) للمستخدم أو الكابتن عند تسجيل الدخول.
  * العميل يتصل بـ Centrifugo مباشرة بالـ Token.
* **مساحات القنوات (Namespaces):**
  1. `orders:*`: لمتابعة حالات الطلب. مع تفعيل `history_size: 10` و `history_ttl: 300s` لتعويض انقطاع الإنترنت المؤقت للهاتف.
  2. `tracking:*`: لمتابعة إحداثيات السائق الحية. **بدون History** لتوفير ذاكرة RAM في Redis.
* **محرك التشغيل:** الربط مع Redis Engine (`"engine": "redis"`) للسماح بعمل Horizontal Scaling مستقبلاً.

### ج. MinIO (التخزين المتوافق مع S3)
* **التكامل مع Django:** استخدام حزمة `django-storages[boto3]`.
* **حل فخ الـ Endpoints (The Endpoint Trap):**
  * دجانجو يتصل داخلياً عبر `http://minio:9000`.
  * يتم ضبط `AWS_S3_CUSTOM_DOMAIN = "media.foxshop.com"` لكي يرسل دجانجو لتطبيق الهاتف روابط خارجية يمكن للموبايل الوصول إليها.
* **نمط الرفع المباشر (Presigned URLs):**
  * دجانجو ينشئ رابط رفع موقع (Presigned PUT URL) لتقوم لوحة تحكم المطعم برفع الصور مباشرة إلى MinIO دون المرور بسيرفر دجانجو.

### د. Redis & نمط تتبع الموقع (GPS Live Tracking)
* **تخزين الإحداثيات الحية:**
  * استقبال إحداثيات الكابتن عبر دجانجو وتخزينها فوراً في Redis باستخدام أوامر الـ Geospatial:
    ```redis
    GEOADD drivers:active <longitude> <latitude> <driver_id>
    ```
  * جلب أقرب السائقين لمطعم معين بسرعة فائقة:
    ```redis
    GEOSEARCH drivers:active FROMLONLAT <lng> <lat> BYRADIUS 5 km ASC
    ```
* **نمط Write-Behind:** لا يتم حفظ إحداثيات كل ثانيتين في PostgreSQL؛ بل تحفظ النقاط الحيوية فقط (استلام، تسليم، وملخص المسار) عند اكتمال الطلب.

### هـ. PostgreSQL 16 + PostGIS
* **الصورة المعتمدة:** `postgis/postgis:16-3.4` بدلاً من `postgres:16` القياسية.
* **التكامل:** تفعيل `django.contrib.gis` في دجانجو لتخزين مضلعات نطاق التوصيل (`PolygonField`) وحساب التقاطعات الجغرافية داخل قاعدة البيانات مباشرة.

---

## 4. مخطط مسودة `docker-compose.yml` المرجعي

```yaml
version: '3.8'

services:
  # 1. Traefik Reverse Proxy
  traefik:
    image: traefik:v3.0
    container_name: foxshop_traefik
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=admin@foxshop.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certificates:/letsencrypt
    networks:
      - foxshop-network
    restart: always

  # 2. PostgreSQL + PostGIS
  db:
    image: postgis/postgis:16-3.4
    container_name: foxshop_db
    environment:
      POSTGRES_DB: foxshop_db
      POSTGRES_USER: foxshop_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - foxshop-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U foxshop_user -d foxshop_db"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  # 3. Redis
  redis:
    image: redis:7-alpine
    container_name: foxshop_redis
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    networks:
      - foxshop-network
    restart: always

  # 4. Centrifugo
  centrifugo:
    image: centrifugo/centrifugo:v5
    container_name: foxshop_centrifugo
    volumes:
      - ./centrifugo_config.json:/centrifugo/config.json
    command: centrifugo -c config.json
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.centrifugo.rule=Host(`ws.foxshop.com`)"
      - "traefik.http.routers.centrifugo.entrypoints=websecure"
      - "traefik.http.routers.centrifugo.tls.certresolver=myresolver"
      - "traefik.http.services.centrifugo.loadbalancer.server.port=8000"
    networks:
      - foxshop-network
    depends_on:
      - redis
    restart: always

  # 5. MinIO S3 Storage
  minio:
    image: minio/minio:latest
    container_name: foxshop_minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio_admin
      MINIO_ROOT_PASSWORD: minio_secure_password
    volumes:
      - minio_data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.minio-media.rule=Host(`media.foxshop.com`)"
      - "traefik.http.routers.minio-media.entrypoints=websecure"
      - "traefik.http.routers.minio-media.tls.certresolver=myresolver"
      - "traefik.http.services.minio-media.loadbalancer.server.port=9000"
    networks:
      - foxshop-network
    restart: always

  # 6. Django Web App
  web:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: foxshop_api
    command: gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3
    environment:
      - DATABASE_URL=postgis://foxshop_user:secure_password@db:5432/foxshop_db
      - REDIS_URL=redis://redis:6379/0
      - CENTRIFUGO_API_URL=http://centrifugo:8000/api
      - AWS_S3_ENDPOINT_URL=http://minio:9000
      - AWS_S3_CUSTOM_DOMAIN=media.foxshop.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.foxshop.com`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=myresolver"
      - "traefik.http.services.api.loadbalancer.server.port=8000"
    networks:
      - foxshop-network
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: always

  # 7. Celery Worker & Beat
  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: foxshop_celery_worker
    command: celery -A core worker -l info
    networks:
      - foxshop-network
    depends_on:
      - web
      - redis
    restart: always

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: foxshop_celery_beat
    command: celery -A core beat -l info
    networks:
      - foxshop-network
    depends_on:
      - web
      - redis
    restart: always

networks:
  foxshop-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  minio_data:
  traefik_certificates:
```

---

## 5. محاذير تشغيلية ومعايير بيئة الإنتاج (Production Checklist)

1. **إدارة قفل المعاملات (Race Conditions):**
   * عند إسناد الكابتن للطلب، استخدم دائماً `select_for_update()` في Django لضمان عدم إسناد الطلب لكابتنين في نفس الجزء من الثانية.
2. **النسخ الاحتياطي لوحدات التخزين (Volume Backups):**
   * وحدات `postgres_data` و `minio_data` تحوي كامل بيانات المتجر والصور؛ يجب عمل Snapshots دورية لها على مستوى السيرفر.
3. **تطبيق الهاتف بالخلفية (FCM Fallback):**
   * لا تعتمد على Centrifugo كقناة وحيدة للإشعارات؛ يجب إرسال Push Notification عبر Firebase (FCM) فور وصول الطلب أو تغير حالته الحرجة لضمان وصول التنبيه حتى لو كان التطبيق مغلقاً.
