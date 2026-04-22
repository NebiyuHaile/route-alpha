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
- contact request capture and email notification
- account registration, login, and token-based auth

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

### `POST /contact`

Accepts:

- `full_name`
- `email`
- `company`
- `team_size`
- `use_case`
- `message`

Flow:

1. saves the contact request to PostgreSQL
2. sends an email notification to `nebiyuhaile385@gmail.com`
3. returns submission and email-delivery status

### `POST /auth/register`

Creates a user account and returns a bearer token plus user details.

### `POST /auth/login`

Signs a user in and returns a bearer token plus user details.

### `GET /auth/me`

Returns the currently authenticated user.

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
CONTACT_NOTIFICATION_EMAIL=nebiyuhaile385@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail_address@gmail.com
SMTP_PASSWORD=your_gmail_app_password_here
SMTP_SENDER_EMAIL=your_gmail_address@gmail.com
AUTH_SECRET_KEY=replace_with_a_long_random_secret
AUTH_TOKEN_EXPIRE_HOURS=24
```
