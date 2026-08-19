# RouteAlpha Project Status

## Current Build

RouteAlpha currently has five user-facing product surfaces:

- `/` marketing and startup-style landing page
- `/auth` sign-in and account creation flow
- `/dashboard` analytics dashboard for routing observability
- `/infer` live inference playground for testing prompts and route decisions
- `/contact` backend-connected contact and demo request page

## What Has Been Built

### Backend

- FastAPI API with health and inference endpoints
- route-tier abstraction across `cheap`, `medium`, and `strong`
- static rule-based routing retained as a safe fallback
- local ONNX semantic classification for `code_generation`, `creative_writing`, `classification`, and `summarization`
- dynamic Pareto-style model selection balancing normalized cost, latency, and accuracy
- validated per-request routing policies with cost, latency, and accuracy weights that sum to 1.0
- bounded in-memory moving telemetry windows for route cost and latency
- task-specific model accuracy ratings, including evaluator-adjusted persisted ratings
- fallback routing across ordered route tiers when primary calls fail
- task type and priority-aware route selection
- route reasoning, semantic match, and candidate routing scores returned with each inference response
- LiteLLM and OpenRouter integration for real model calls
- latency, token, and estimated cost tracking
- PostgreSQL-backed inference logging
- fallback metadata logging (`resolved_route_key`, `fallback_used`, attempted routes/models)
- optional expected JSON Schema capture for structured-output evaluation
- Celery evaluator that validates structured responses or uses an LLM-as-a-judge for open-ended responses
- evaluator feedback loop that lowers a model's task-specific accuracy rating after sustained failures
- backend-backed contact request capture
- email notification delivery for contact requests
- user account registration and login
- bearer token authentication for protected API routes
- analytics queries for summary, route, model, cost, latency, and recent request views
- summary analytics include fallback count and fallback rate percentage

### Frontend

- responsive shared navigation across product pages
- auth session provider with local session persistence
- startup-style landing page with:
  - hero section
  - live metrics preview
  - platform/features section
  - workflow section
  - pricing section
  - FAQ section
  - closing CTA section
- dashboard experience with:
  - summary cards
  - insight cards
  - fallback activity insight card
  - route breakdown chart
  - model breakdown chart
  - cost by model chart
  - latency by model chart
  - recent requests table
  - search, filters, sorting, and row limits
  - row-level fallback badges and resolved-route visibility
- inference playground with:
  - preset prompts
  - task type selection
  - priority selection
  - request submission states
  - result metadata display
  - response display
- auth flow with:
  - account creation
  - sign-in
  - session restore on refresh
  - protected dashboard and inference access
- contact flow with:
  - demo request form
  - team and use case capture
  - backend submission
  - email delivery status feedback
  - success and error states

## Architecture Notes

- `frontend/app/page.tsx` is now the landing-page entrypoint
- `frontend/app/dashboard/page.tsx` serves the analytics product surface
- `frontend/app/auth/page.tsx` serves sign-in and registration
- `frontend/components/LandingPage.tsx` contains the main marketing experience
- `frontend/components/DashboardPage.tsx` contains the dashboard experience extracted from the previous homepage
- `frontend/components/Navbar.tsx` is the shared nav across all app surfaces
- `frontend/app/contact/page.tsx` is the lead capture and demo request entrypoint
- `backend/app/services/embedding_router.py` contains the local ONNX semantic classifier
- `backend/app/services/pareto_router.py` contains routing-policy validation, telemetry, and Pareto scoring
- `backend/app/tasks/evaluator.py` contains the asynchronous evaluator and feedback loop
- `docs/dynamic_routing.md` documents the semantic-routing pipeline and Pareto math
- `docs/run_routealpha_locally.md` documents local startup with SQLite or PostgreSQL

## Recent Product Direction

- shifted the homepage from a raw dashboard into a startup-style product site
- preserved the original analytics UI by moving it to a dedicated `/dashboard` route
- tightened the navigation to support both marketing exploration and direct app usage
- added a real conversion path with a backend-connected contact page
- added the first real auth layer so product workflows can be gated behind accounts
- added fallback routing so failed primary model attempts can resolve via backup routes
- surfaced fallback observability in dashboard insights and recent-request rows
- evolved routing from purely static heuristics into semantic and multi-objective dynamic selection
- kept static routing as the fail-safe path when optional local semantic assets or dynamic dependencies are unavailable
- kept the design language polished and product-oriented instead of purely internal-tool styling

## Verified Working State

- frontend lint passes with `npm run lint`
- app routes are organized for:
  - landing page
  - auth page
  - dashboard
  - inference playground
  - contact page
- backend Phase 1 modules compile and smoke checks cover Pareto policy validation, route selection, FastAPI import, and semantic-router fallback behavior

## Runtime Notes

- local ONNX semantic classification requires `model.onnx` and `tokenizer.json` in the configured `EMBEDDING_MODEL_DIR`; the API safely falls back to static routing when they are absent or invalid
- continuous evaluator feedback requires a configured Celery broker and `OPENROUTER_API_KEY` for open-ended LLM-as-a-judge evaluations
- PostgreSQL is the intended production datastore; the local run guide also documents SQLite for a quick local demo

## Next Likely Steps

- add a docs or product-tour page
- add screenshots or richer real data previews to the landing page
- add tests around routing, analytics, and page-level UI flows
- provision and verify the Celery broker for continuous evaluator feedback
- replace process-local telemetry with a shared store before horizontally scaling the API
- differentiate the current `medium` and `strong` route model mappings with production benchmarking
- implement and validate the planned Phase 2 high-performance data/control-plane split before enabling it
