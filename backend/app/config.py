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
CONTACT_NOTIFICATION_EMAIL = os.getenv(
    "CONTACT_NOTIFICATION_EMAIL",
    "nebiyuhaile385@gmail.com",
)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = _get_int_env("SMTP_PORT", 587)
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL", SMTP_USERNAME or "")
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "routealpha-dev-secret-change-me")
AUTH_TOKEN_EXPIRE_HOURS = _get_int_env("AUTH_TOKEN_EXPIRE_HOURS", 24)

MODEL_CATALOG = {
    "cheap": "openrouter/google/gemini-2.0-flash-lite-001",
    "medium": "openrouter/openai/gpt-4o-mini",
    "strong": "openrouter/openai/gpt-4o-mini"
}

FALLBACK_ROUTE_ORDER = {
    "cheap": ["cheap", "medium", "strong"],
    "medium": ["medium", "strong", "cheap"],
    "strong": ["strong", "medium", "cheap"],
}
