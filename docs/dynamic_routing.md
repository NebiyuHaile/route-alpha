# Dynamic and Semantic Routing

RouteAlpha routes each request in three stages: local semantic classification, dynamic Pareto scoring, then normal model execution and fallback.

## Local ONNX semantic classification

At FastAPI startup, `EmbeddingRouter` loads `model.onnx` and `tokenizer.json` from `EMBEDDING_MODEL_DIR` (default `./models/all-MiniLM-L6-v2-onnx`). It runs the tokenizer and ONNX Runtime CPU session locally; no external LLM request is made. Token hidden states are attention-mask mean pooled and L2 normalized. Category vectors are precomputed from the examples in `TASK_EXAMPLES`.

For a normalized prompt vector `p` and category vector `c`, cosine similarity is `p · c`. NumPy calculates all category dot products in one matrix-vector operation and chooses the maximum. If model assets or inference fail, no exception reaches the client: RouteAlpha uses its static route fallback.

To add a category, add a stable key and two or more representative phrases to `TASK_EXAMPLES` in `backend/app/services/embedding_router.py`. Restart the API to rebuild preset vectors. Add an accuracy prior in `MODEL_ACCURACY_RATINGS` only when introducing a model route, not for a category.

## Pareto score

The policy contains `cost_weight`, `latency_weight`, and `accuracy_weight`; Pydantic requires each to be in `[0, 1]` and their sum to equal `1.0`.

For every candidate route, the telemetry tracker maintains bounded moving averages of price per 1k tokens and latency seconds. Each raw cost or latency value is normalized across current candidates using:

`x_norm = (x - min(x)) / (max(x) - min(x))`

When all candidates have the same value, every normalized value is zero. The selected route has the lowest score:

`score = cost_weight * normalized_cost + latency_weight * normalized_latency - accuracy_weight * accuracy_rating`

The API emits a structured `pareto_routing_decision` log with semantic match data, raw and normalized inputs, every candidate score, and the winner.

## Feedback loop

Run the Celery worker with `celery -A app.tasks.evaluator.celery_app worker --loglevel=INFO`. The `evaluate_and_update_weights` task samples recent `InferenceLog` entries. Outputs with `expected_json_schema` are validated programmatically; other outputs are graded Pass/Fail by `JUDGE_MODEL`. Models whose task-specific sample failure rate passes the configured threshold have their persisted `ModelTaskPerformance.accuracy_rating` lowered. The next request reads these ratings before Pareto scoring.

Set `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, and `OPENROUTER_API_KEY` in production. The API process remains safe if the worker or local ONNX assets are unavailable; only those optional dynamic signals are bypassed.
