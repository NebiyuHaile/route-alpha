# RouteAlpha Frontend

The frontend is a Next.js dashboard and inference workspace for RouteAlpha.

## What It Includes

- analytics summary cards for request volume, latency, and estimated cost
- chart views for route distribution, model usage, cost by model, and latency by model
- polished custom chart tooltips and dashboard insight cards
- a recent requests table with loading states, empty states, filtering, searching, and sortable columns
- an inference playground for running prompts against the backend and reviewing routing metadata

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

## Environment

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Key Files

- `app/page.tsx`: dashboard experience and analytics UI
- `app/infer/page.tsx`: inference submission flow and response review
- `app/layout.tsx`: app metadata and shared shell setup
- `app/globals.css`: global visual styling and base theme
- `components/Navbar.tsx`: shared top navigation

## Design Direction

The current UI is intentionally built around:

- bright, editorial-style surfaces instead of plain flat white panels
- glassy layered cards with soft shadows and clearer spacing
- high-signal empty/loading states for operational clarity
- dashboard interactions that feel productized rather than default-library

## Validation

For a quick frontend lint check:

```bash
npx eslint app/page.tsx app/infer/page.tsx components/Navbar.tsx
```
