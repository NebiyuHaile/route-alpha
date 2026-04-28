from __future__ import annotations

from typing import Any
from time import perf_counter
from litellm import completion
from app.config import FALLBACK_ROUTE_ORDER, OPENROUTER_API_KEY, MODEL_CATALOG
from app.token_utils import estimate_tokens
from app.pricing import MODEL_PRICING


def _build_fallback_candidates(route_key: str) -> list[tuple[str, str]]:
    ordered_routes = FALLBACK_ROUTE_ORDER.get(route_key, [route_key])
    seen_models: set[str] = set()
    candidates: list[tuple[str, str]] = []

    for candidate_route in ordered_routes:
        model_name = MODEL_CATALOG[candidate_route]
        if model_name in seen_models:
            continue
        seen_models.add(model_name)
        candidates.append((candidate_route, model_name))

    return candidates


def _execute_model_call(model_name: str, prompt: str) -> dict[str, Any]:
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is missing")

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


def call_model(route_key: str, prompt: str) -> dict[str, Any]:
    attempts: list[dict[str, str]] = []
    fallback_reason: str | None = None

    for candidate_route, model_name in _build_fallback_candidates(route_key):
        try:
            result = _execute_model_call(model_name=model_name, prompt=prompt)
            result["resolved_route_key"] = candidate_route
            result["fallback_used"] = candidate_route != route_key
            result["fallback_reason"] = fallback_reason
            result["attempted_routes"] = [attempt["route_key"] for attempt in attempts] + [
                candidate_route
            ]
            result["attempted_models"] = [attempt["model_used"] for attempt in attempts] + [
                model_name
            ]
            return result
        except Exception as exc:
            attempts.append(
                {
                    "route_key": candidate_route,
                    "model_used": model_name,
                    "error": str(exc),
                }
            )
            if fallback_reason is None:
                fallback_reason = str(exc)

    attempt_summary = " | ".join(
        f"{attempt['route_key']} -> {attempt['model_used']}: {attempt['error']}"
        for attempt in attempts
    )
    raise RuntimeError(
        f"All routing attempts failed for primary route '{route_key}'. {attempt_summary}"
    )
