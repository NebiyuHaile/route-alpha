from dotenv import load_dotenv
import os

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

MODEL_CATALOG = {
    "cheap": "openrouter/google/gemini-2.0-flash-lite-001",
    "medium": "openrouter/openai/gpt-4o-mini",
    "strong": "openrouter/openai/gpt-4o-mini"
}