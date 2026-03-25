# RouteAlpha

RouteAlpha is a backend-first AI inference routing system that intelligently selects a model route based on request complexity, task type, and user priority. The goal is to simulate a startup-grade multi-model routing platform that balances cost, speed, and quality.

## Current Status

This project is currently in the early backend phase. The first working version of the routing API is complete and supports real model inference using OpenRouter through LiteLLM.

## Features Implemented So Far

### Backend API
- Built with **FastAPI**
- Virtual environment configured
- Environment variable support added with `.env`
- GitHub repository initialized and connected

### Endpoints
- `GET /health`  
  Confirms the backend service is running

- `POST /infer`  
  Accepts a prompt and routes the request to a selected model

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