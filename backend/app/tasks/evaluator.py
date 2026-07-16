"""Celery feedback task that validates outputs and updates accuracy ratings."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from celery import Celery
from jsonschema import ValidationError, validate
from litellm import acompletion

from app.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND, EVALUATOR_FAILURE_THRESHOLD, EVALUATOR_SAMPLE_SIZE, JUDGE_MODEL, OPENROUTER_API_KEY
from app.database import SessionLocal
from app.models import InferenceLog, ModelTaskPerformance

logger = logging.getLogger(__name__)
celery_app = Celery("routealpha", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)
celery_app.conf.beat_schedule = {
    "evaluate-routing-performance-every-five-minutes": {
        "task": "routealpha.evaluate_and_update_weights",
        "schedule": 300.0,
    }
}
celery_app.conf.timezone = "UTC"


def _validate_structured_response(response: str, schema: dict[str, Any]) -> bool:
    """Return whether a JSON response parses and satisfies its requested schema."""
    try:
        validate(instance=json.loads(response), schema=schema)
        return True
    except (json.JSONDecodeError, ValidationError):
        return False


async def _judge_open_ended_response(prompt: str, response: str) -> bool:
    """Ask the configured high-capability judge for a strict Pass/Fail verdict.

    Raises:
        RuntimeError: If no judge credential is configured or the judge returns
            an unparseable verdict; callers record this as an operational error.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is required for LLM-as-a-judge evaluation")
    verdict = await acompletion(
        model=JUDGE_MODEL,
        api_key=OPENROUTER_API_KEY,
        temperature=0,
        max_tokens=3,
        messages=[{"role": "system", "content": "Judge whether the response adequately answers the prompt. Reply exactly Pass or Fail."}, {"role": "user", "content": f"PROMPT:\n{prompt}\n\nRESPONSE:\n{response}"}],
    )
    answer = str(verdict.choices[0].message.content).strip().lower()
    if answer not in {"pass", "fail"}:
        raise RuntimeError(f"judge returned invalid verdict: {answer!r}")
    return answer == "pass"


@celery_app.task(name="routealpha.evaluate_and_update_weights")
def evaluate_and_update_weights(sample_size: int = EVALUATOR_SAMPLE_SIZE) -> dict[str, int]:
    """Evaluate recent logs and persist task-specific exponential accuracy updates.

    Structured requests are checked locally against their stored JSON Schema.
    Open-ended requests are evaluated asynchronously by the judge. A model's
    rating is updated only when its observed failure rate exceeds the configured
    threshold, preventing one noisy result from changing production routing.
    """
    db = SessionLocal()
    processed = failed = updated = 0
    try:
        logs = db.query(InferenceLog).order_by(InferenceLog.created_at.desc()).limit(sample_size).all()
        grouped: dict[tuple[str, str], list[bool]] = defaultdict(list)
        for log in logs:
            try:
                passed = _validate_structured_response(log.response, json.loads(log.expected_json_schema)) if log.expected_json_schema else asyncio.run(_judge_open_ended_response(log.prompt, log.response))
                grouped[(log.model_used, log.task_type or "general")].append(passed)
                processed += 1
                failed += int(not passed)
            except Exception:
                logger.exception("evaluator_request_failed", extra={"request_id": log.request_id, "model": log.model_used})
        for (model_used, task_type), verdicts in grouped.items():
            failures = len(verdicts) - sum(verdicts)
            failure_rate = failures / len(verdicts)
            if failure_rate < EVALUATOR_FAILURE_THRESHOLD:
                continue
            record = db.query(ModelTaskPerformance).filter_by(model_used=model_used, task_type=task_type).one_or_none()
            if record is None:
                record = ModelTaskPerformance(model_used=model_used, task_type=task_type, accuracy_rating=max(0.0, 1.0 - failure_rate), sample_count=0, failure_count=0)
                db.add(record)
            record.accuracy_rating = max(0.05, record.accuracy_rating * (1.0 - failure_rate))
            record.sample_count += len(verdicts)
            record.failure_count += failures
            updated += 1
        db.commit()
        logger.info("evaluator_completed", extra={"processed": processed, "failed": failed, "updated": updated})
        return {"processed": processed, "failed": failed, "updated": updated}
    except Exception:
        db.rollback()
        logger.exception("evaluator_failed")
        raise
    finally:
        db.close()
