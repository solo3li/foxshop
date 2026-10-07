from rest_framework.renderers import BaseRenderer
import logging

logger = logging.getLogger(__name__)

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
            return orjson.dumps(data)
        except Exception:
            import json
            return json.dumps(data).encode('utf-8')
