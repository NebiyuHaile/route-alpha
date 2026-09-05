from dotenv import load_dotenv
import os

load_dotenv()


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc


def _get_list_env(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if not raw_value:
        return default
    return [item.strip() for item in raw_value.split(",") if item.strip()]


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
CORS_ORIGINS = _get_list_env("CORS_ORIGINS", ["http://localhost:3000"])
CONTACT_NOTIFICATION_EMAIL = os.getenv("CONTACT_NOTIFICATION_EMAIL")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = _get_int_env("SMTP_PORT", 587)
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL", SMTP_USERNAME or "")
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
if not AUTH_SECRET_KEY:
    raise RuntimeError(
        "AUTH_SECRET_KEY is required. Set it to a long random secret before "
        "starting the RouteAlpha API."
    )
AUTH_TOKEN_EXPIRE_HOURS = _get_int_env("AUTH_TOKEN_EXPIRE_HOURS", 24)
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
