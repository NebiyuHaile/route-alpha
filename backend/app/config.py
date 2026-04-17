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
