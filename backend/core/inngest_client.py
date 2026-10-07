import os
import inngest
import logging

logger = logging.getLogger(__name__)

INNGEST_BASE_URL = os.getenv("INNGEST_BASE_URL", "http://inngest:8288")
INNGEST_EVENT_KEY = os.getenv("INNGEST_EVENT_KEY", "local-dev-event-key")
INNGEST_SIGNING_KEY = os.getenv("INNGEST_SIGNING_KEY", "local-dev-signing-key")
IS_PRODUCTION = os.getenv("DEBUG", "1") == "0"

inngest_client = inngest.Inngest(
    app_id="foxshop",
    api_base_url=INNGEST_BASE_URL if not IS_PRODUCTION else None,
    event_api_base_url=INNGEST_BASE_URL if not IS_PRODUCTION else None,
    event_key=INNGEST_EVENT_KEY,
    signing_key=INNGEST_SIGNING_KEY if IS_PRODUCTION else None,
    is_production=IS_PRODUCTION,
)
