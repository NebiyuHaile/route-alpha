# RouteAlpha

RouteAlpha is a full-stack AI inference routing platform that selects a model route based on request complexity, task type, and user priority. The project now includes both a startup-style marketing site and a working operator product surface for testing, routing, and analytics.

## Overview

Instead of sending every request to the same model, RouteAlpha routes prompts across different model paths such as `cheap`, `medium`, and `strong`. The current version includes a working backend API, PostgreSQL logging, analytics endpoints, a polished landing page, a dedicated dashboard, and a live inference playground.

## Current Features

- FastAPI backend
- real model inference through LiteLLM and OpenRouter
- rule-based routing by task type, prompt length, and priority
- fallback routing with ordered route failover and attempted-route tracking
- route reasoning returned in API responses
- latency measurement
- token estimation
- cost estimation
- PostgreSQL request logging
- analytics summary and breakdown endpoints
- startup-style landing page with hero, platform sections, workflow, pricing, FAQ, and product CTAs
- dedicated dashboard route with charts, insights, and recent requests table
- inference playground for prompt submission and route inspection
- backend-connected contact and demo request flow
- account registration and login
- protected dashboard and inference APIs via bearer auth
- shared responsive navigation across landing, dashboard, and inference pages
- recent requests filtering, search, sorting, and row limit controls
- fallback observability in the dashboard (summary fallback activity + row-level fallback state)
- production-minded environment examples for frontend and backend deployment
- configurable backend CORS origins for local, staging, and hosted frontends
- routing policy tests for priority, task type, and prompt-length decisions

## Tech Stack

- Python
- FastAPI
- LiteLLM
- OpenRouter
- SQLAlchemy
- Next.js
- TypeScript
- Tailwind CSS
- Recharts

## Current Status

The project currently supports:
- `/` startup landing page
- `/auth` sign-in and registration
- `/dashboard` analytics and observability workspace
- `/infer` live inference playground
- `/contact` contact and demo request page
- `GET /health`
- `POST /infer`
- `POST /contact`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /analytics/fallbacks`
- analytics endpoints for summaries and breakdowns
- a dedicated marketing front door connected to real app flows

## App Pages

### Landing Page

The landing page shows:
- startup-style hero and product positioning
- live analytics preview pulled from backend summary data when available
- product/platform feature sections
- workflow explanation for routing decisions
- pricing-style packaging for the product surface
- FAQ and final call-to-action sections

### Auth

The auth page allows users to:
- create an account
- sign in with email and password
- restore a saved session on refresh
- access protected dashboard and inference workflows

### Dashboard

The dashboard shows:
- total requests
- average latency
- total estimated cost
- fallback request count and fallback rate
- route breakdown
- model breakdown
- cost by model
- latency by model
- fallback breakdowns by route, model, and trend
- recent requests table with fallback badges and resolved-route visibility

### Inference

The inference page allows users to:
- enter a prompt
- choose task type
- choose priority
- submit an inference request
- view route details, model used, token estimates, cost, latency, and response text

### Contact

The contact page allows teams to:
- submit a demo request
- share company and team size information
- describe routing use cases and product needs
- send lead information directly to the backend

## Project Notes

- Progress and feature tracking live in `PROJECT_STATUS.md`
- The homepage is now marketing-focused, while operator workflows live in `/dashboard` and `/infer`
- Conversion and demo intake now live at `/contact`
- Authentication now protects the main product workflows
- Landing-page live preview gracefully falls back to an offline/demo state when protected analytics APIs are unavailable
- The frontend is intentionally positioned to feel like a startup product rather than a raw internal tool

## Project Structure

```bash
route-alpha/
├── README.md
├── PROJECT_STATUS.md
├── backend/
│   ├── README.md
│   ├── .env.example
│   ├── app/
│   ├── tests/
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── README.md
    ├── .env.example
    ├── app/
    ├── components/
    ├── package.json
    └── .env.local
```

## Deployment Readiness

Copy the example environment files before deploying:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Set `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET_KEY`, and `CORS_ORIGINS`
for the backend environment. Set `NEXT_PUBLIC_API_BASE_URL` and, for hosted
metadata, `NEXT_PUBLIC_SITE_URL` for the frontend environment.

Validation commands:

```bash
cd backend
pytest
```

```bash
cd frontend
npm run lint
npm run build
```
