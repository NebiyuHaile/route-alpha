# RouteAlpha

RouteAlpha is a full-stack AI inference routing platform that selects a model route based on request complexity, task type, and user priority. The project is designed to evolve into a startup-style AI systems platform focused on balancing cost, speed, and quality across model calls.

## Overview

Instead of sending every request to the same model, RouteAlpha routes prompts across different model paths such as `cheap`, `medium`, and `strong`. The current version includes a working backend API, PostgreSQL logging, analytics endpoints, a frontend dashboard, and a frontend inference page.

## Current Features

- FastAPI backend
- real model inference through LiteLLM and OpenRouter
- rule-based routing by task type, prompt length, and priority
- route reasoning returned in API responses
- latency measurement
- token estimation
- cost estimation
- PostgreSQL request logging
- analytics summary and breakdown endpoints
- frontend dashboard with charts and recent requests table
- frontend inference page for prompt submission
- shared navigation between dashboard and inference pages

## Tech Stack

- Python
- FastAPI
- LiteLLM
- OpenRouter
- PostgreSQL
- SQLAlchemy
- Next.js
- TypeScript
- Tailwind CSS
- Recharts

## Current Status

The project currently supports:
- `GET /health`
- `POST /infer`
- analytics endpoints for summaries and breakdowns
- a dashboard page for analytics visualization
- an inference page for manual prompt submission

## App Pages

### Dashboard
The dashboard shows:
- total requests
- average latency
- total estimated cost
- route breakdown
- model breakdown
- cost by model
- latency by model
- recent requests table

### Inference
The inference page allows users to:
- enter a prompt
- choose task type
- choose priority
- submit an inference request
- view route details, model used, token estimates, cost, latency, and response text

## Project Structure

```bash
route-alpha/
├── README.md
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── app/
    ├── components/
    ├── package.json
    └── .env.local
