# RouteAlpha Frontend

The frontend is a Next.js product site and app workspace for RouteAlpha.

## What It Includes

- analytics summary cards for request volume, latency, and estimated cost
- fallback observability cards for reroute volume and rate
- fallback breakdown analytics for primary route, resolved model, and trend
- chart views for route distribution, model usage, cost by model, and latency by model
- polished custom chart tooltips and dashboard insight cards
- a recent requests table with loading states, empty states, filtering, searching, sorting, and fallback badges
- an inference playground for running prompts against the backend and reviewing routing metadata
- a startup-style landing page with product messaging and calls into the live app
- shared responsive navigation between landing, dashboard, and inference flows
- a backend-connected contact and demo request page
- sign-in and registration flow with local session persistence

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Key routes:

```text
/            landing page
/auth        sign-in and registration
/dashboard   analytics dashboard
/infer       inference playground
/contact     contact and demo request page
```

## Environment

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Key Files

- `app/page.tsx`: landing page route entry
- `app/dashboard/page.tsx`: dashboard route entry
- `app/auth/page.tsx`: sign-in and registration
- `app/infer/page.tsx`: inference submission flow and response review
- `app/contact/page.tsx`: contact and demo request flow
- `app/layout.tsx`: app metadata and shared shell setup
- `app/globals.css`: global visual styling and base theme
- `components/LandingPage.tsx`: marketing homepage experience
- `components/DashboardPage.tsx`: dashboard analytics experience
- `components/Navbar.tsx`: shared top navigation
- `components/AuthProvider.tsx`: session storage and auth API integration
- `components/RequireAuth.tsx`: protected route wrapper for app surfaces

## Auth Behavior

- `/dashboard` and `/infer` use authenticated API requests through `AuthProvider`
- analytics and inference backend routes require a bearer token
- the landing page attempts a live analytics preview and falls back to an offline/demo state if protected data cannot be loaded

## Design Direction

The current UI is intentionally built around:

- a startup-facing front door connected to real product flows
- bright, editorial-style surfaces instead of plain flat white panels
- glassy layered cards with soft shadows and clearer spacing
- high-signal empty/loading states for operational clarity
- dashboard interactions that feel productized rather than default-library

## Validation

For a quick frontend lint check:

```bash
npx eslint app/page.tsx app/dashboard/page.tsx app/infer/page.tsx components/Navbar.tsx
```
