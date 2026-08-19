# RouteAlpha `/infer` API Reference

## 1. Endpoint

- Path: `POST /infer`
- No `/api` prefix. [Source: `backend/app/main.py`](../backend/app/main.py#L242)

## 2. Request body

```json
{
  "prompt": "string, required",
  "task_type": "string | null, optional; default: general",
  "priority": "string | null, optional; default: balanced",
  "routing_policy": {
    "cost_weight": 0.34,
    "latency_weight": 0.33,
    "accuracy_weight": 0.33
  },
  "expected_json_schema": {}
}
```

Source: [`backend/app/schemas.py`](../backend/app/schemas.py#L7)

| Field | Type / constraints |
|---|---|
| `prompt` | Required string; 1–100,000 characters. |
| `task_type` | Optional nullable string; default: `general`. There is no enum validation, so `code_generation` and any other string are accepted. |
| `priority` | Optional nullable string; default: `balanced`. There is no enum validation. The routing layer recognizes `cheap`, `fast`, and `quality`; all other values, including `balanced`, use the default Pareto policy. [Source](../backend/app/main.py#L231) |
| `routing_policy` | Optional object. Each weight is a float from `0.0` to `1.0`; all weights must total `1.0`. [Source](../backend/app/services/pareto_router.py#L18) |
| `expected_json_schema` | Optional JSON object stored for structured-output evaluation. |

`code_generation` is a configured semantic category. The other configured categories are `creative_writing`, `classification`, and `summarization`. [Source](../backend/app/services/embedding_router.py#L29)

These are semantic-classifier outputs, not the only allowed request values. When `task_type` is `general`, a successful semantic match replaces it with the detected category. [Source](../backend/app/main.py#L247)

## 3. Successful response body

```json
{
  "request_id": "uuid",
  "route_key": "cheap | medium | strong",
  "route_reason": "string",
  "resolved_route_key": "cheap | medium | strong",
  "fallback_used": false,
  "fallback_reason": "string | null",
  "attempted_routes": ["cheap"],
  "attempted_models": ["provider/model-name"],
  "model_used": "provider/model-name",
  "task_type": "string | null",
  "priority": "string | null",
  "estimated_input_tokens": 0,
  "estimated_output_tokens": 0,
  "estimated_cost_usd": 0.0,
  "response": "model response text",
  "latency_ms": 0.0,
  "semantic_category": "string | null",
  "semantic_similarity": 0.0,
  "pareto_score": 0.0,
  "candidate_scores": {}
}
```

Source: [`backend/app/main.py`](../backend/app/main.py#L305)

| Field | Meaning |
|---|---|
| `route_key` | Initially selected tier. |
| `route_reason` | Why RouteAlpha chose that route. |
| `resolved_route_key` | Tier that actually succeeded after any fallback. |
| `fallback_used` | `true` when a backup route served the request. |
| `semantic_category` | Detected semantic category, or `null` when the local classifier is unavailable. |
| `semantic_similarity` | Cosine similarity score for the selected category, or `null`. |
| `pareto_score` | Winning dynamic score, or `null` when static routing was used. |
| `candidate_scores` | Object keyed by `cheap`, `medium`, and `strong`. Each value includes `cost_per_1k`, `latency_seconds`, `accuracy_rating`, `normalized_cost`, `normalized_latency`, and `pareto_score`. [Source](../backend/app/services/pareto_router.py#L105) |
| `estimated_input_tokens`, `estimated_output_tokens`, `estimated_cost_usd`, `latency_ms` | Usage, estimated cost, and observed latency metadata. |

## 4. Authentication

`/infer` requires a bearer token:

```http
Authorization: Bearer <access_token>
```

The endpoint depends on `get_current_user`. [Source](../backend/app/main.py#L242) The authentication dependency rejects missing/non-bearer credentials, decodes the token, and verifies the account is active. [Source](../backend/app/main.py#L89)

Get an access token from either:

- `POST /auth/register` — creates an account and returns an `access_token`. [Source](../backend/app/main.py#L124)
- `POST /auth/login` — signs in and returns an `access_token`. [Source](../backend/app/main.py#L160)

Successful auth responses have this shape:

```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "user_id": "string",
    "full_name": "string",
    "email": "string",
    "company": "string | null"
  }
}
```

Source: [`backend/app/schemas.py`](../backend/app/schemas.py#L45)

## 5. Local port and startup command

The backend runs locally at `http://127.0.0.1:8000`.

```bash
cd ~/Documents/GitHub/route-alpha/backend
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Source: [`docs/run_routealpha_locally.md`](run_routealpha_locally.md#L45)

## 6. Does `/infer` need authentication?

Yes. A POST body alone is insufficient.

1. Create an account through `POST /auth/register`, or sign in through `POST /auth/login`.
2. Read the returned `access_token`.
3. Send `Authorization: Bearer <access_token>` with the `POST /infer` request.

## 7. Health check

```http
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "RouteAlpha backend"
}
```

Source: [`backend/app/main.py`](../backend/app/main.py#L119)
