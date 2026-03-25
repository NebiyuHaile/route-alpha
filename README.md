# RouteAlpha

RouteAlpha is a backend-first AI inference routing system that selects a model route based on request complexity, task type, and user priority. The project is designed to evolve into a startup-style multi-model routing platform focused on balancing cost, speed, and quality.

## Current Status

The current version includes a working backend API with real model inference, rule-based routing, and latency reporting.

## Project Purpose

This project explores how AI systems can route requests to different models instead of sending every request to the same one. The current backend focuses on routing logic, model invocation, and API structure.

## Implemented Functionality

### Backend API
The backend is built with FastAPI and provides the main inference service.

### Health Check Endpoint
`GET /health`

This endpoint confirms that the backend service is running.

### Inference Endpoint
`POST /infer`

This endpoint accepts a request prompt and routes it to a selected model based on task type, prompt length, and priority.

### Request Inputs
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
