# RouteAlpha

RouteAlpha is a backend-first AI inference routing system that selects a model route based on request complexity, task type, and user priority. The project is being built into a startup-style multi-model routing platform focused on balancing cost, speed, and quality.

## Current Status

The current backend version is working and supports:

- real model inference
- rule-based route selection
- route reasoning
- latency reporting
- token estimation
- cost estimation
- request ID generation
- PostgreSQL request logging
- analytics endpoints for summaries and breakdowns

## Project Purpose

RouteAlpha explores how AI systems can intelligently choose between model routes instead of sending every request to the same model. The current project focuses on routing logic, model invocation, request metadata, database persistence, and analytics.

## Implemented Functionality

### Backend API
The backend is built with FastAPI and serves as the main inference layer.

### Health Check Endpoint
`GET /health`

This endpoint confirms that the backend service is running.

### Inference Endpoint
`POST /infer`

This endpoint accepts a prompt and routes it to a selected model based on task type, prompt length, and priority. It also saves the request and response metadata into PostgreSQL.

### Analytics Endpoints
The backend currently includes:

- `GET /analytics/summary`
- `GET /analytics/routes`
- `GET /analytics/models`

These endpoints read from PostgreSQL and return usage summaries and breakdowns.

## Request Inputs

The `/infer` endpoint currently accepts:

- `prompt`
- `task_type`
- `priority`

Example request:

```json
{
  "prompt": "Write a Python function to merge two sorted linked lists.",
  "task_type": "coding",
  "priority": "balanced"
}
```

## Routing Logic

The current routing layer is rule-based.

Available route categories:

- `cheap`
- `medium`
- `strong`

Routing decisions are based on:

- prompt length
- task type
- user priority

Example routing behavior:

- short simple prompts -> cheap
- medium-length prompts -> medium
- coding and reasoning tasks -> strong
- quality priority -> strong
- cheap priority -> cheap

## Model Integration

Real model inference is currently handled through:

- **LiteLLM**
- **OpenRouter**

The backend is configured to call models through the model catalog defined in `backend/app/config.py`.

## Response Output

The `/infer` endpoint currently returns:

- `request_id`
- `route_key`
- `route_reason`
- `model_used`
- `task_type`
- `priority`
- `estimated_input_tokens`
- `estimated_output_tokens`
- `estimated_cost_usd`
- `response`
- `latency_ms`

## Database Logging

Inference requests are stored in PostgreSQL in the `inference_logs` table.

Saved fields include:

- `request_id`
- `prompt`
- `task_type`
- `priority`
- `route_key`
- `route_reason`
- `model_used`
- `estimated_input_tokens`
- `estimated_output_tokens`
- `estimated_cost_usd`
- `latency_ms`
- `response`
- `created_at`

## Current Capabilities

The project currently supports:

- FastAPI backend service
- health check endpoint
- real LLM inference
- rule-based route selection
- route explanation output
- request ID generation
- latency measurement
- estimated token usage
- estimated request cost
- PostgreSQL persistence
- analytics summaries and breakdowns
- modular backend structure

## Repository Structure

```bash
route-alpha/
├── .gitignore
├── README.md
└── backend/
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

## Tech Stack

- Python
- FastAPI
- LiteLLM
- OpenRouter
- PostgreSQL
- SQLAlchemy
- Pydantic
- Uvicorn
- python-dotenv

## Local Setup

### 1. Move into the backend directory

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

### 4. Create a `.env` file

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/routealpha_db
```

### 5. Start the backend server

```bash
uvicorn app.main:app --reload
```

### 6. Open the API documentation

```text
http://127.0.0.1:8000/docs
```

## Next Planned Features

- additional analytics endpoints for cost and latency breakdowns
- more route and model test data
- fallback routing
- multi-model comparison
- dashboard integration

## Vision

RouteAlpha is intended to become a startup-style AI infrastructure project that demonstrates:

- model routing
- latency awareness
- cost awareness
- backend engineering
- persistence and analytics
- observability
- production-style API design
