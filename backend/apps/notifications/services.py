import json
import logging
import requests
import jwt
from django.conf import settings
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

def generate_centrifugo_connection_token(user_id):
    """Generates an HMAC-SHA256 connection JWT for Centrifugo v5 client"""
    payload = {
        'sub': str(user_id),
        'exp': int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
    }
    token = jwt.encode(payload, settings.CENTRIFUGO_HMAC_SECRET, algorithm='HS256')
    return token


def publish_centrifugo_event(channel, event_type, data):
    """Publishes a real-time event to a Centrifugo channel via HTTP API"""
    api_url = f"{settings.CENTRIFUGO_API_URL.rstrip('/')}/publish"
    headers = {
        'X-API-Key': settings.CENTRIFUGO_API_KEY,
        'Content-Type': 'application/json'
    }
    payload = {
        'channel': channel,
        'data': {
            'event': event_type,
            'payload': data,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    }

    timeout = 0.2 if getattr(settings, 'DEBUG', False) else 2.0
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=timeout)
        if response.status_code != 200:
            logger.warning(f"Centrifugo publish returned status {response.status_code}: {response.text}")
        return True
    except Exception as e:
        logger.warning(f"Failed to publish event {event_type} to Centrifugo ({channel}): {e}")
        return False


def send_fcm_push_notification(user_id, title, body, data=None):
    """Fallback FCM Push Notification for mobile apps when WebSockets are in background"""
    logger.info(f"[Mock FCM Push] To User: {user_id} | Title: {title} | Body: {body} | Data: {data}")
    return True


def notify_driver_approved(driver_user):
    """Notifies driver in real-time that their account has been approved and activated by admin"""
    channel = f"orders:driver_{driver_user.id}"
    data = {
        'driver_id': str(driver_user.id),
        'username': driver_user.username,
        'first_name': driver_user.first_name,
        'message': 'تهانينا! تم تفعيل واعتماد حسابك بنجاح من قبل الإدارة. يمكنك الآن بدء العمل واستقبال الطلبات 🚀',
        'is_active': True,
    }
    publish_centrifugo_event(channel, 'DRIVER_APPROVED', data)
    send_fcm_push_notification(
        user_id=driver_user.id,
        title="تم تفعيل حساب الكابتن 🎉",
        body="تمت مراجعة واعتماد حسابك بنجاح، يمكنك الآن الاتصال وبدء العمل!",
        data={'event': 'DRIVER_APPROVED'}
    )
    return True
