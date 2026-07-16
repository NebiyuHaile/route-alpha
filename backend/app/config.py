from dotenv import load_dotenv
import os

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
CONTACT_NOTIFICATION_EMAIL = os.getenv(
    "CONTACT_NOTIFICATION_EMAIL",
    "nebiyuhaile385@gmail.com",
)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL", SMTP_USERNAME or "")
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "routealpha-dev-secret-change-me")
AUTH_TOKEN_EXPIRE_HOURS = int(os.getenv("AUTH_TOKEN_EXPIRE_HOURS", "24"))
EMBEDDING_MODEL_DIR = os.getenv("EMBEDDING_MODEL_DIR", "./models/all-MiniLM-L6-v2-onnx")
EMBEDDING_MAX_LENGTH = int(os.getenv("EMBEDDING_MAX_LENGTH", "128"))
TELEMETRY_WINDOW_SIZE = int(os.getenv("TELEMETRY_WINDOW_SIZE", "200"))
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
EVALUATOR_SAMPLE_SIZE = int(os.getenv("EVALUATOR_SAMPLE_SIZE", "100"))
EVALUATOR_FAILURE_THRESHOLD = float(os.getenv("EVALUATOR_FAILURE_THRESHOLD", "0.25"))
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "openrouter/openai/gpt-4o")

MODEL_CATALOG = {
    "cheap": "openrouter/google/gemini-2.0-flash-lite-001",
    "medium": "openrouter/openai/gpt-4o-mini",
    "strong": "openrouter/openai/gpt-4o-mini"
}

# Ratings are deliberately explicit product priors. Live evaluator feedback is
# persisted separately and takes precedence over these values at routing time.
MODEL_ACCURACY_RATINGS = {
    "cheap": 0.68,
    "medium": 0.82,
    "strong": 0.93,
}

FALLBACK_ROUTE_ORDER = {
    "cheap": ["cheap", "medium", "strong"],
    "medium": ["medium", "strong", "cheap"],
    "strong": ["strong", "medium", "cheap"],
}
