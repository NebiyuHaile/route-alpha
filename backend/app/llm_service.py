from time import perf_counter
from litellm import completion
from app.config import OPENROUTER_API_KEY, MODEL_CATALOG


def call_model(route_key: str, prompt: str):
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is missing")

    model_name = MODEL_CATALOG[route_key]

    start = perf_counter()

    response = completion(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        api_key=OPENROUTER_API_KEY,
        max_tokens=300
    )

    latency_ms = round((perf_counter() - start) * 1000, 2)
    response_text = response["choices"][0]["message"]["content"]

    return model_name, response_text, latency_ms