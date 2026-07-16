"""Dynamic Pareto-style routing based on cost, latency, and accuracy."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Mapping

from pydantic import BaseModel, Field, model_validator

from app.config import MODEL_ACCURACY_RATINGS, TELEMETRY_WINDOW_SIZE

logger = logging.getLogger(__name__)


class RoutingPolicy(BaseModel):
    """Validated user preference vector for dynamic routing.

    The weights must sum to one so the score remains interpretable across
    requests: ``score = wc*C_norm + wl*L_norm - wa*A``.
    """

    cost_weight: float = Field(0.34, ge=0.0, le=1.0)
    latency_weight: float = Field(0.33, ge=0.0, le=1.0)
    accuracy_weight: float = Field(0.33, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "RoutingPolicy":
        """Reject policies whose weights do not sum to one within float tolerance."""
        if abs(self.cost_weight + self.latency_weight + self.accuracy_weight - 1.0) > 1e-6:
            raise ValueError("cost_weight, latency_weight, and accuracy_weight must sum to 1.0")
        return self


@dataclass(frozen=True, slots=True)
class ModelTelemetry:
    """Moving-average values used in one model score."""

    cost_per_1k: float
    latency_seconds: float


@dataclass(frozen=True, slots=True)
class RoutingDecision:
    """Auditable result of scoring all candidates."""

    route_key: str
    score: float
    candidate_scores: dict[str, dict[str, float]]


class TelemetryTracker:
    """Concurrency-safe in-memory sliding-window model telemetry tracker.

    This implementation has no network dependency and can be replaced by a
    Redis-backed implementation through the same async ``record``/``snapshot``
    interface when traffic spans multiple API processes.
    """

    def __init__(self, window_size: int = TELEMETRY_WINDOW_SIZE) -> None:
        """Initialize bounded metric windows for each route key."""
        self._windows: dict[str, deque[ModelTelemetry]] = defaultdict(lambda: deque(maxlen=window_size))
        self._lock = asyncio.Lock()

    async def record(self, route_key: str, cost_per_1k: float, latency_seconds: float) -> None:
        """Append one completed-call observation to the route's sliding window."""
        if cost_per_1k < 0 or latency_seconds < 0:
            raise ValueError("telemetry values must be non-negative")
        async with self._lock:
            self._windows[route_key].append(ModelTelemetry(cost_per_1k, latency_seconds))

    async def snapshot(self, route_keys: tuple[str, ...], defaults: Mapping[str, ModelTelemetry]) -> dict[str, ModelTelemetry]:
        """Return moving averages, using configured priors before live samples exist."""
        async with self._lock:
            result: dict[str, ModelTelemetry] = {}
            for route_key in route_keys:
                samples = self._windows[route_key]
                if not samples:
                    result[route_key] = defaults[route_key]
                    continue
                count = len(samples)
                result[route_key] = ModelTelemetry(
                    sum(item.cost_per_1k for item in samples) / count,
                    sum(item.latency_seconds for item in samples) / count,
                )
            return result


DEFAULT_TELEMETRY: dict[str, ModelTelemetry] = {
    "cheap": ModelTelemetry(0.00025, 0.8),
    "medium": ModelTelemetry(0.00040, 1.2),
    "strong": ModelTelemetry(0.00080, 2.0),
}


class ParetoRouter:
    """Select the minimum weighted score across available downstream routes."""

    def __init__(self, telemetry: TelemetryTracker) -> None:
        """Construct a router backed by the supplied telemetry tracker."""
        self._telemetry = telemetry

    async def choose(self, policy: RoutingPolicy, accuracy_ratings: Mapping[str, float] | None = None) -> RoutingDecision:
        """Calculate and log candidate scores, then return the minimum.

        Normalization is min-max: ``x_norm = (x-min(x))/(max(x)-min(x))``.
        Equal values normalize to zero because none is worse on that metric.
        """
        route_keys = tuple(DEFAULT_TELEMETRY)
        telemetry = await self._telemetry.snapshot(route_keys, DEFAULT_TELEMETRY)
        ratings = dict(MODEL_ACCURACY_RATINGS)
        if accuracy_ratings:
            ratings.update(accuracy_ratings)
        costs = {key: telemetry[key].cost_per_1k for key in route_keys}
        latencies = {key: telemetry[key].latency_seconds for key in route_keys}
        normalized_costs = _min_max_normalize(costs)
        normalized_latencies = _min_max_normalize(latencies)
        scores: dict[str, dict[str, float]] = {}
        for key in route_keys:
            accuracy = max(0.0, min(1.0, ratings[key]))
            score = policy.cost_weight * normalized_costs[key] + policy.latency_weight * normalized_latencies[key] - policy.accuracy_weight * accuracy
            scores[key] = {"cost_per_1k": costs[key], "latency_seconds": latencies[key], "accuracy_rating": accuracy, "normalized_cost": normalized_costs[key], "normalized_latency": normalized_latencies[key], "pareto_score": score}
        winner = min(scores, key=lambda key: scores[key]["pareto_score"])
        logger.info("pareto_routing_decision", extra={"policy": policy.model_dump(), "candidate_scores": scores, "winning_route": winner})
        return RoutingDecision(winner, scores[winner]["pareto_score"], scores)


def _min_max_normalize(values: Mapping[str, float]) -> dict[str, float]:
    """Map a metric mapping into [0, 1], assigning zero for a zero range."""
    lower, upper = min(values.values()), max(values.values())
    if upper == lower:
        return {key: 0.0 for key in values}
    return {key: (value - lower) / (upper - lower) for key, value in values.items()}
