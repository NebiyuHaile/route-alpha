from time import perf_counter
from litellm import completion
from app.config import OPENROUTER_API_KEY, MODEL_CATALOG
from app.token_utils import estimate_tokens
from app.pricing import MODEL_PRICING


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

    input_tokens = estimate_tokens(prompt)
    output_tokens = estimate_tokens(response_text)

    pricing = MODEL_PRICING.get(model_name, {"input_per_1k": 0, "output_per_1k": 0})
    estimated_cost_usd = round(
        (input_tokens / 1000) * pricing["input_per_1k"] +
        (output_tokens / 1000) * pricing["output_per_1k"],
        6
    )

    return {
        "model_used": model_name,
        "response_text": response_text,
        "latency_ms": latency_ms,
        "estimated_input_tokens": input_tokens,
        "estimated_output_tokens": output_tokens,
        "estimated_cost_usd": estimated_cost_usd,
    }