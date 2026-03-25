# RouteAlpha

RouteAlpha is a backend-first AI inference routing system that selects a model route based on request complexity, task type, and user priority. The project is designed to grow into a startup-style multi-model routing platform focused on balancing cost, speed, and quality.

## Current Status

The current backend version is working and supports:
- real model inference
- rule-based route selection
- route reasoning
- latency reporting
- token estimation
- cost estimation
- request ID generation

## Project Purpose

RouteAlpha explores how AI systems can intelligently choose between model routes instead of sending every request to the same model. The backend currently focuses on routing logic, model invocation, request metadata, and response metrics.

## Implemented Functionality

### Backend API
The backend is built with FastAPI and serves as the main inference layer.

### Health Check Endpoint
`GET /health`

This endpoint confirms that the backend service is running.

### Inference Endpoint
`POST /infer`

This endpoint accepts a prompt and routes it to a selected model based on task type, prompt length, and priority.

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