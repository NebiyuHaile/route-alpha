# RouteAlpha Backend

This service powers RouteAlpha's inference routing and analytics API.

## Responsibilities

- health checking
- inference routing
- live model calls through LiteLLM and OpenRouter
- token estimation
- request cost estimation
- PostgreSQL request logging
- analytics queries for the dashboard

## Core Endpoints

### `GET /health`

Confirms that the backend service is running.

### `POST /infer`

Accepts:

- `prompt`
- `task_type`
- `priority`

Flow:

1. chooses a route using rule-based routing
2. calls a model through LiteLLM and OpenRouter
3. estimates token usage and cost
4. saves the request to PostgreSQL
5. returns the response plus metadata

### `GET /analytics/summary`

Returns:

- total requests
- average latency
- total estimated cost

### `GET /analytics/routes`

Returns route usage counts grouped by `route_key`.

### `GET /analytics/models`

Returns model usage counts grouped by `model_used`.

### `GET /analytics/costs`

Returns aggregate cost grouped by model.

### `GET /analytics/latency`

Returns average latency grouped by model.

### `GET /analytics/recent`

Returns recent requests for the frontend dashboard table.

## File Map

- `app/main.py`: FastAPI entry point and route definitions
- `app/schemas.py`: request and response schemas
- `app/config.py`: environment loading and model configuration
- `app/router.py`: route selection logic
- `app/llm_service.py`: model call orchestration and metadata capture
- `app/token_utils.py`: token estimation helpers
- `app/pricing.py`: pricing constants for cost estimation
- `app/database.py`: SQLAlchemy engine, session, and base setup
- `app/models.py`: database models including `InferenceLog`
- `app/analytics.py`: analytics query functions

## Local Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

## Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/routealpha_db
```
