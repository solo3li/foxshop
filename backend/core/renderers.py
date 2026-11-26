import decimal
import json
import uuid
from rest_framework.renderers import BaseRenderer
import logging

logger = logging.getLogger(__name__)

def default_json_serializer(obj):
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return str(obj)

class ORJSONRenderer(BaseRenderer):
    """
    High-performance JSON renderer using orjson.
    Falls back gracefully to standard JSON if orjson is not installed.
    """
    media_type = 'application/json'
    format = 'json'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b''

        try:
            import orjson
            return orjson.dumps(data, default=default_json_serializer)
        except Exception:
            return json.dumps(data, default=default_json_serializer).encode('utf-8')

