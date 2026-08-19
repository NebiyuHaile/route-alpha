# Debug Log

## 2026-07-22 — Auth flow

| Step | Result | Finding |
| --- | --- | --- |
| Backend startup / `GET /health` | Pass | `200 OK` |
| `POST /auth/register` | Pass | `200 OK`; token issued |
| `POST /auth/login` | Pass | `200 OK`; token issued |
| Protected route with valid bearer token | Pass | `GET /auth/me` returned `200 OK` |
| Protected route without token | Pass | `401 Authentication required.` |
| Protected route with malformed token | Pass | `401 Invalid token format.` |
| Bugs found | None | — |

## 2026-07-30 — Security review — auth (implementation)

| Item | Fix applied | Verification result |
| --- | --- | --- |
| Login rate limiting | SlowAPI-backed in-memory limiter records failed login attempts per client IP + normalized email; limit is 5 per 15 minutes and returns `429` with `Retry-After`. | Pass — attempts 1–5 returned `401`; attempt 6 returned `429` with `Retry-After: 900`. |
| Password rules | Registration now requires 8–128 characters with at least one letter and one number; the auth UI shows the same missing-requirement message before submission. | Pass — letter-only, number-only, and short passwords each returned `422` with the specific missing requirement; frontend lint passed. |
| Opt-in TOTP 2FA | Added protected setup and enable endpoints, persisted TOTP enrollment fields, and required an authenticator code at login only after enrollment. | Pass — non-enrolled login returned `200`; setup and enable returned `200`; enabled login without OTP returned `401`; enabled login with current OTP returned `200`; frontend lint passed. |
| Server-side admin role | Added `is_admin` (default `false`) and reusable `require_admin` dependency that checks the persisted server-side user role. No admin route or UI was added. | Pass — a normal authenticated user received `403 Administrator access is required.` from a temporary test-only route using the dependency. |

## 2026-08-02 — Frontend responsiveness and UI check

| Area | Result | Verification / finding |
| --- | --- | --- |
| Public responsive layout | Pass | `/`, `/auth`, and `/contact` had no body horizontal overflow at 375px, 768px, or 1440px. |
| Auth and 2FA UI | Pass | Registration showed immediate weak-password feedback and created a throwaway account; login exposes the optional OTP input. |
| Landing navigation | Pass | Platform, Workflow, Pricing, and FAQ anchors updated URL and exposed their target sections; Contact navigation worked. |
| Dashboard controls | Pass with accessibility finding | Refresh, route/model filters, row limit, search, and all sortable headers responded. The visible dashboard labels are not associated with their controls, so label-based assistive-technology interaction fails. |
| Authenticated responsive layout | Pass | `/dashboard` and `/infer` had no body horizontal overflow at 375px, 768px, or 1440px. |
| Inference playground | Pass | Preset, task/priority selection, reset, live submission, result rendering, response copy, and dashboard navigation worked. |
| Contact submission | Fail | `POST /contact` did not return within 5 seconds and the UI remained pending; direct local request also timed out with no response. |
| Sign-out | Pass | Sign-out cleared the session and redirected the protected route to `/auth?next=...`. |
| Frontend lint | Pass | `npm run lint` completed successfully. |
