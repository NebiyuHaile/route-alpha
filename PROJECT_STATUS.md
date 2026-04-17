# RouteAlpha Project Status

## Current Build

RouteAlpha currently has four user-facing product surfaces:

- `/` marketing and startup-style landing page
- `/dashboard` analytics dashboard for routing observability
- `/infer` live inference playground for testing prompts and route decisions
- `/contact` backend-connected contact and demo request page

## What Has Been Built

### Backend

- FastAPI API with health and inference endpoints
- rule-based routing across `cheap`, `medium`, and `strong`
- task type and priority-aware route selection
- route reasoning returned with each inference response
- LiteLLM and OpenRouter integration for real model calls
- latency, token, and estimated cost tracking
- PostgreSQL-backed inference logging
- backend-backed contact request capture
- email notification delivery for contact requests
- analytics queries for summary, route, model, cost, latency, and recent request views

### Frontend

- responsive shared navigation across product pages
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
  - route breakdown chart
  - model breakdown chart
  - cost by model chart
  - latency by model chart
  - recent requests table
  - search, filters, sorting, and row limits
- inference playground with:
  - preset prompts
  - task type selection
  - priority selection
  - request submission states
  - result metadata display
  - response display
- contact flow with:
  - demo request form
  - team and use case capture
  - backend submission
  - email delivery status feedback
  - success and error states

## Architecture Notes

- `frontend/app/page.tsx` is now the landing-page entrypoint
- `frontend/app/dashboard/page.tsx` serves the analytics product surface
- `frontend/components/LandingPage.tsx` contains the main marketing experience
- `frontend/components/DashboardPage.tsx` contains the dashboard experience extracted from the previous homepage
- `frontend/components/Navbar.tsx` is the shared nav across all app surfaces
- `frontend/app/contact/page.tsx` is the lead capture and demo request entrypoint

## Recent Product Direction

- shifted the homepage from a raw dashboard into a startup-style product site
- preserved the original analytics UI by moving it to a dedicated `/dashboard` route
- tightened the navigation to support both marketing exploration and direct app usage
- added a real conversion path with a backend-connected contact page
- kept the design language polished and product-oriented instead of purely internal-tool styling

## Verified Working State

- frontend lint passes with `npm run lint`
- app routes are organized for:
  - landing page
  - dashboard
  - inference playground
  - contact page

## Next Likely Steps

- add auth and user accounts
- add a docs or product-tour page
- add screenshots or richer real data previews to the landing page
- expand routing logic beyond current rule-based heuristics
- add tests around routing, analytics, and page-level UI flows
