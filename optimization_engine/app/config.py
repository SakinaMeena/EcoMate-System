import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL        = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
MAPBOX_TOKEN        = os.getenv("MAPBOX_ACCESS_TOKEN", "")
CRON_HOUR           = int(os.getenv("CRON_HOUR", "20"))   # 8 PM UTC = 4 AM MYT
CRON_MINUTE         = int(os.getenv("CRON_MINUTE", "0"))
USE_MOCK_DATA       = os.getenv("USE_MOCK_DATA", "false").lower() == "true"
USE_MAPBOX = os.getenv("USE_MAPBOX", "true").lower() == "true"
