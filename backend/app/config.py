from __future__ import annotations

import base64
import hashlib
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from cryptography.fernet import Fernet

load_dotenv()


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc


def _get_float_env(name: str, default: float | None = None) -> float:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        if default is None:
            raise RuntimeError(f"{name} is required.")
        return default
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number.") from exc
    if value < 0:
        raise RuntimeError(f"{name} must be non-negative.")
    return value


def _get_list_env(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if not raw_value:
        return default
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _get_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be a boolean.")


def _get_model_catalog() -> dict[str, str]:
    """Load explicit tier mappings while retaining useful development defaults."""
    defaults = {
        "cheap": "openrouter/google/gemini-3.5-flash-lite",
        "medium": "openrouter/openai/gpt-4o-mini",
        "strong": "openrouter/openai/gpt-4o",
    }
    values = {
        "cheap": os.getenv("MODEL_CHEAP", defaults["cheap"]),
        "medium": os.getenv("MODEL_MEDIUM", defaults["medium"]),
        "strong": os.getenv("MODEL_STRONG", defaults["strong"]),
    }
    if any(not value.strip() for value in values.values()):
        raise RuntimeError("MODEL_CHEAP, MODEL_MEDIUM, and MODEL_STRONG must be non-empty.")
    if len(set(values.values())) != len(values):
        raise RuntimeError("Model tiers must map to distinct model identifiers.")
    return values


def _derive_development_totp_key(auth_secret: str) -> str:
    """Derive a local-only Fernet key so TOTP secrets are never stored in plaintext."""
    return base64.urlsafe_b64encode(hashlib.sha256(auth_secret.encode("utf-8")).digest()).decode(
        "utf-8"
    )


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
CORS_ORIGINS = _get_list_env("CORS_ORIGINS", ["http://localhost:3000"])
TRUSTED_HOSTS = _get_list_env("TRUSTED_HOSTS", ["localhost", "127.0.0.1"])
ENFORCE_HTTPS = _get_bool_env("ENFORCE_HTTPS", IS_PRODUCTION)
AUTO_CREATE_SCHEMA = _get_bool_env("AUTO_CREATE_SCHEMA", not IS_PRODUCTION)
CONTACT_NOTIFICATION_EMAIL = os.getenv("CONTACT_NOTIFICATION_EMAIL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_SENDER = os.getenv("EMAIL_SENDER")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
if not AUTH_SECRET_KEY:
    raise RuntimeError(
        "AUTH_SECRET_KEY is required. Set it to a long random secret before "
        "starting the RouteAlpha API."
    )
AUTH_TOKEN_EXPIRE_HOURS = _get_int_env("AUTH_TOKEN_EXPIRE_HOURS", 24)
AUTH_TOKEN_ISSUER = os.getenv("AUTH_TOKEN_ISSUER", "routealpha-api")
AUTH_TOKEN_AUDIENCE = os.getenv("AUTH_TOKEN_AUDIENCE", "routealpha-web")
if not AUTH_TOKEN_ISSUER or not AUTH_TOKEN_AUDIENCE:
    raise RuntimeError("AUTH_TOKEN_ISSUER and AUTH_TOKEN_AUDIENCE must be non-empty.")
if AUTH_TOKEN_EXPIRE_HOURS <= 0 or AUTH_TOKEN_EXPIRE_HOURS > 24:
    raise RuntimeError("AUTH_TOKEN_EXPIRE_HOURS must be between 1 and 24.")
TOTP_ENCRYPTION_KEY = os.getenv("TOTP_ENCRYPTION_KEY")
if not TOTP_ENCRYPTION_KEY:
    if IS_PRODUCTION:
        raise RuntimeError(
            "TOTP_ENCRYPTION_KEY is required in production to encrypt two-factor secrets at rest."
        )
    TOTP_ENCRYPTION_KEY = _derive_development_totp_key(AUTH_SECRET_KEY)
try:
    Fernet(TOTP_ENCRYPTION_KEY.encode("utf-8"))
except (TypeError, ValueError) as exc:
    raise RuntimeError("TOTP_ENCRYPTION_KEY must be a valid Fernet key.") from exc

RATE_LIMIT_STORAGE_URI = os.getenv("RATE_LIMIT_STORAGE_URI", "memory://")
TELEMETRY_REDIS_URL = os.getenv("TELEMETRY_REDIS_URL", "")
METRICS_TOKEN = os.getenv("METRICS_TOKEN")

if IS_PRODUCTION:
    if not DATABASE_URL or not DATABASE_URL.startswith("postgresql://"):
        raise RuntimeError("DATABASE_URL must use PostgreSQL in production.")
    if not RATE_LIMIT_STORAGE_URI.startswith(("redis://", "rediss://")):
        raise RuntimeError("RATE_LIMIT_STORAGE_URI must use a shared Redis store in production.")
    if not TELEMETRY_REDIS_URL.startswith(("redis://", "rediss://")):
        raise RuntimeError("TELEMETRY_REDIS_URL must use Redis in production.")
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is required in production.")
    if not CORS_ORIGINS or any(origin == "*" for origin in CORS_ORIGINS):
        raise RuntimeError("CORS_ORIGINS must contain explicit production origins.")
    if not TRUSTED_HOSTS or any(host == "*" for host in TRUSTED_HOSTS):
        raise RuntimeError("TRUSTED_HOSTS must contain explicit production hosts.")
    if not ENFORCE_HTTPS:
        raise RuntimeError("ENFORCE_HTTPS must be true in production.")
    if not METRICS_TOKEN:
        raise RuntimeError("METRICS_TOKEN is required in production.")
    if not RESEND_API_KEY or not EMAIL_SENDER:
        raise RuntimeError("RESEND_API_KEY and EMAIL_SENDER are required in production.")
    parsed_frontend_url = urlparse(FRONTEND_BASE_URL)
    if parsed_frontend_url.scheme != "https" or not parsed_frontend_url.netloc:
        raise RuntimeError("FRONTEND_BASE_URL must be an HTTPS URL in production.")
    if AUTO_CREATE_SCHEMA:
        raise RuntimeError("AUTO_CREATE_SCHEMA must be false in production; run Alembic migrations instead.")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required.")
EMBEDDING_MODEL_DIR = os.getenv("EMBEDDING_MODEL_DIR", "./models/all-MiniLM-L6-v2-onnx")
EMBEDDING_MAX_LENGTH = _get_int_env("EMBEDDING_MAX_LENGTH", 128)
TELEMETRY_WINDOW_SIZE = _get_int_env("TELEMETRY_WINDOW_SIZE", 200)
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
EVALUATOR_SAMPLE_SIZE = _get_int_env("EVALUATOR_SAMPLE_SIZE", 100)
EVALUATOR_FAILURE_THRESHOLD = float(os.getenv("EVALUATOR_FAILURE_THRESHOLD", "0.25"))
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "openrouter/openai/gpt-4o")
MODEL_REQUEST_TIMEOUT_SECONDS = _get_float_env("MODEL_REQUEST_TIMEOUT_SECONDS", 30.0)
MAX_INFERENCE_CONCURRENCY = _get_int_env("MAX_INFERENCE_CONCURRENCY", 20)
INFERENCE_QUEUE_TIMEOUT_SECONDS = _get_float_env("INFERENCE_QUEUE_TIMEOUT_SECONDS", 5.0)
REGISTER_RATE_LIMIT = os.getenv("REGISTER_RATE_LIMIT", "5/hour")
RESEND_VERIFICATION_RATE_LIMIT = os.getenv("RESEND_VERIFICATION_RATE_LIMIT", "3/hour")
VERIFY_EMAIL_RATE_LIMIT = os.getenv("VERIFY_EMAIL_RATE_LIMIT", "10/hour")
CONTACT_RATE_LIMIT = os.getenv("CONTACT_RATE_LIMIT", "10/hour")
INFERENCE_RATE_LIMIT = os.getenv("INFERENCE_RATE_LIMIT", "60/minute")
EMAIL_VERIFICATION_TOKEN_TTL_HOURS = _get_int_env("EMAIL_VERIFICATION_TOKEN_TTL_HOURS", 24)
if MODEL_REQUEST_TIMEOUT_SECONDS <= 0:
    raise RuntimeError("MODEL_REQUEST_TIMEOUT_SECONDS must be greater than zero.")
if MAX_INFERENCE_CONCURRENCY <= 0:
    raise RuntimeError("MAX_INFERENCE_CONCURRENCY must be greater than zero.")
if INFERENCE_QUEUE_TIMEOUT_SECONDS <= 0:
    raise RuntimeError("INFERENCE_QUEUE_TIMEOUT_SECONDS must be greater than zero.")
if EMAIL_VERIFICATION_TOKEN_TTL_HOURS <= 0 or EMAIL_VERIFICATION_TOKEN_TTL_HOURS > 72:
    raise RuntimeError("EMAIL_VERIFICATION_TOKEN_TTL_HOURS must be between 1 and 72.")

MODEL_CATALOG = _get_model_catalog()


def _get_model_pricing() -> dict[str, dict[str, float]]:
    """Use environment-controlled prices so production cost estimates match contracts."""
    development_defaults = {
        "cheap": (0.00030, 0.00250),
        "medium": (0.00015, 0.00060),
        "strong": (0.00250, 0.01000),
    }
    pricing: dict[str, dict[str, float]] = {}
    for tier, model_name in MODEL_CATALOG.items():
        defaults = development_defaults[tier]
        pricing[model_name] = {
            "input_per_1k": _get_float_env(
                f"MODEL_{tier.upper()}_INPUT_PER_1K",
                None if IS_PRODUCTION else defaults[0],
            ),
            "output_per_1k": _get_float_env(
                f"MODEL_{tier.upper()}_OUTPUT_PER_1K",
                None if IS_PRODUCTION else defaults[1],
            ),
        }
    return pricing


MODEL_PRICING = _get_model_pricing()

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
