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

## 2026-09-05 — Production-readiness baseline

| Item | Result | Verification / finding |
| --- | --- | --- |
| Frontend dependency security | Pass | Upgraded Next.js and matching ESLint config to `16.4.0`; `npm audit --omit=dev --audit-level=high` reported `0 vulnerabilities`. |
| Shared production state | Pass in code/config | Production startup now requires Redis rate-limit and telemetry URIs; local development retains in-memory state. Multi-instance Redis verification requires deployed Redis infrastructure. |
| TOTP encryption at rest | Pass | New TOTP secrets use Fernet encryption; setup, enable, required OTP login, and encrypted database persistence smoke test passed. |
| Sensitive upstream errors | Pass | Provider failures are logged by error class and no longer return raw upstream details to API clients. |
| Production configuration | Pass | Strict production configuration import accepted valid PostgreSQL, Redis, HTTPS, host/origin, provider, auth-secret, and Fernet-key values. |
| Health probes | Pass | `GET /health` and `GET /health/ready` returned `200` during the local smoke test. |
| Protected metrics | Pass | `/internal/metrics` returned `404` without `X-Metrics-Token` and Prometheus output with a valid token. |
| Schema migrations | Pass | Alembic initial schema migration added; production startup rejects automatic schema creation, and `python -m alembic upgrade head` created every expected table in a clean SQLite smoke database. |
| Configured provider models | Pass | Read-only OpenRouter catalog validation found the former cheap-tier identifier unavailable; it was replaced with available `google/gemini-3.5-flash-lite`. The medium and strong identifiers were already available; published pricing was captured as configurable per-1K defaults. |
| Browser security headers | Pass | Production response from `/auth` contained CSP, HSTS, frame, MIME, referrer, permissions, and no-store headers. |
| Upstream execution bounds | Pass | Provider calls now use a configurable 30-second deadline; backend tests confirm the timeout is passed to LiteLLM and the API has a configurable concurrency/queue limit. |
| Password hashing | Pass | New passwords use Argon2id; a successful login transparently upgraded a verified legacy PBKDF2 hash in the authentication smoke test. |
| Portable deployment artifacts | Implemented | Added non-root backend/frontend Dockerfiles and pull-request CI for backend tests, frontend lint/build, and high-severity dependency audit. Docker image build verification requires Docker on the release machine. |
| Container artifact verification | Implemented | CI now builds the exact backend and frontend Dockerfiles using their deployment build contexts. Local Docker is unavailable, so the first build result will be recorded by GitHub Actions. |
| API abuse and response controls | Pass | Configurable Redis-backed registration, contact, and inference limits return `429` plus `Retry-After`; health smoke test confirmed API no-store/security/correlation headers, and strict production mode returned `404` for `/docs` with HSTS enabled. |
| Contact lead capture regression | Pass | Endpoint test now proves a valid request is persisted and returns `200` while notification delivery is scheduled separately; a slow or unavailable mail provider is not part of the database transaction. |
| PostgreSQL driver URL validation | Pass | Production configuration accepts the `postgresql://` driver URL supported by the pinned `psycopg2-binary` dependency and rejects an unavailable `postgresql+psycopg://` dialect at startup. |
