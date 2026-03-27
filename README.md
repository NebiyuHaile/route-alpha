# RouteAlpha Backend

This README focuses only on the backend service inside the `backend/` directory.

## What the backend currently does

The backend currently handles:

- health checking
- inference routing
- real model calls
- token estimation
- cost estimation
- PostgreSQL logging
- analytics queries

## Current Endpoints

### `GET /health`
Confirms that the backend service is running.

### `POST /infer`
Accepts a request body with:

- `prompt`
- `task_type`
- `priority`

The endpoint then:

1. chooses a route using rule-based logic
2. calls a real model through LiteLLM and OpenRouter
3. estimates token usage and request cost
4. saves the request to PostgreSQL
5. returns the response and metadata

### `GET /analytics/summary`
Returns:

- total requests
- average latency
- total estimated cost

### `GET /analytics/routes`
Returns route usage counts grouped by `route_key`.

### `GET /analytics/models`
Returns model usage counts grouped by `model_used`.

## Backend File Map

### `app/main.py`
FastAPI entry point and route definitions.

### `app/schemas.py`
Request schema definitions used by the API.

### `app/config.py`
Environment loading, API keys, database URL, and model catalog configuration.

### `app/router.py`
Rule-based routing logic for cheap, medium, and strong routes.

### `app/llm_service.py`
Model call logic through LiteLLM, including latency, token, and cost metadata.

### `app/token_utils.py`
Helper function used to estimate token counts.

### `app/pricing.py`
Pricing values used to estimate request cost.

### `app/database.py`
SQLAlchemy engine, session, and base setup.

### `app/models.py`
Database model definitions, including the `InferenceLog` table.

### `app/analytics.py`
Analytics query functions for summaries and breakdowns.

## Backend Structure

```bash
backend/
├── .env
├── README.md
├── requirements.txt
└── app/
    ├── main.py
    ├── schemas.py
    ├── config.py
    ├── router.py
    ├── llm_service.py
    ├── token_utils.py
    ├── pricing.py
    ├── database.py
    ├── models.py
    └── analytics.py
```

## Environment Variables

The backend currently uses:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/routealpha_db
```

## Running the backend locally

### 1. Move into the backend folder

```bash
cd backend
```

### 2. Create and activate a virtual environment

#### Windows PowerShell
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the backend service

```bash
uvicorn app.main:app --reload
```

### 5. Open the docs

```text
http://127.0.0.1:8000/docs
```

## Current Backend Tech Stack

- Python
- FastAPI
- LiteLLM
- OpenRouter
- PostgreSQL
- SQLAlchemy
- Pydantic
- Uvicorn
- python-dotenv

## Current Backend Milestones Reached

- backend server created and running
- real model inference connected
- route selection logic added
- token and cost estimation added
- PostgreSQL request logging added
- analytics summary and breakdown endpoints added

## Next Backend Steps

- add cost breakdown endpoint
- add latency breakdown endpoint
- test route and model analytics with more records
- prepare data for a frontend dashboard
