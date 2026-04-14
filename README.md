# RouteAlpha

RouteAlpha is a lightweight LLM routing workspace with two parts:

- a FastAPI backend that routes live inference requests, estimates cost, and logs request metadata
- a Next.js frontend that visualizes request activity, model usage, latency, and routing behavior

## Product Snapshot

The current app includes:

- a dashboard with summary cards, route and model charts, recent request search/filtering, empty states, and sortable columns
- custom chart tooltips and higher-signal insight cards for route, usage, and latency trends
- an inference playground for submitting prompts and reviewing route selection, model choice, cost, and latency
- PostgreSQL-backed analytics for request history and aggregate metrics

## Repository Structure

```text
route-alpha/
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── package.json
│   └── .env.local
└── README.md
```

## Running Locally

### 1. Start the backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend docs:

```text
http://127.0.0.1:8000/docs
```

### 2. Start the frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend app:

```text
http://localhost:3000
```

## Environment Variables

### Backend

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/routealpha_db
```

### Frontend

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Backend API Highlights

- `GET /health`: health check
- `POST /infer`: executes routing and returns inference metadata
- `GET /analytics/summary`: total requests, average latency, total cost
- `GET /analytics/routes`: route counts by route key
- `GET /analytics/models`: model counts by model
- `GET /analytics/costs`: aggregate cost by model
- `GET /analytics/latency`: average latency by model
- `GET /analytics/recent`: recent request history for the dashboard table

## Tech Stack

### Frontend

- Next.js App Router
- React
- Tailwind CSS
- Recharts

### Backend

- FastAPI
- LiteLLM
- OpenRouter
- SQLAlchemy
- PostgreSQL
- Pydantic

## Notes

- The dashboard assumes the backend is running and the database contains request records.
- If the database is empty, the UI now shows dedicated empty states instead of a blank table.
- The frontend README covers UI-focused details and workflows.
- The backend README covers backend architecture and endpoints in more detail.
