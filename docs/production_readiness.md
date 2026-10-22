# RouteAlpha production-readiness baseline

This guide covers the minimum operating posture before RouteAlpha is exposed to users outside a private beta.

## Required production configuration

Set `APP_ENV=production`. The API then refuses to start unless all of the following are configured:

- PostgreSQL `DATABASE_URL` (SQLite is local-development only);
- non-empty `OPENROUTER_API_KEY`;
- a long, unique `AUTH_SECRET_KEY`;
- a valid `TOTP_ENCRYPTION_KEY` generated with Fernet;
- a private `METRICS_TOKEN` for the metrics scraper;
- a `RESEND_API_KEY` and verified `EMAIL_SENDER` for account-verification and transactional email;
- an HTTPS `FRONTEND_BASE_URL` for verification links;
- Redis-backed `RATE_LIMIT_STORAGE_URI`;
- Redis `TELEMETRY_REDIS_URL` shared by all API instances;
- explicit `CORS_ORIGINS`;
- explicit `TRUSTED_HOSTS`; and
- input/output price values for every configured model tier.

Example production values:

```env
APP_ENV=production
DATABASE_URL=postgresql://routealpha:...@db.example.com:5432/routealpha
OPENROUTER_API_KEY=...
AUTH_SECRET_KEY=... # generated from a cryptographically secure secret manager
TOTP_ENCRYPTION_KEY=... # Fernet.generate_key()
METRICS_TOKEN=... # long random value used in the X-Metrics-Token request header
RESEND_API_KEY=re_...
EMAIL_SENDER=RouteAlpha <hello@app.example.com>
FRONTEND_BASE_URL=https://app.example.com
RATE_LIMIT_STORAGE_URI=rediss://:...@redis.example.com:6379/0
TELEMETRY_REDIS_URL=rediss://:...@redis.example.com:6379/1
CELERY_BROKER_URL=rediss://:...@redis.example.com:6379/2
CELERY_RESULT_BACKEND=rediss://:...@redis.example.com:6379/2
CORS_ORIGINS=https://app.example.com
TRUSTED_HOSTS=api.example.com
ENFORCE_HTTPS=true
MODEL_CHEAP=openrouter/...
MODEL_MEDIUM=openrouter/...
MODEL_STRONG=openrouter/...
MODEL_CHEAP_INPUT_PER_1K=...
MODEL_CHEAP_OUTPUT_PER_1K=...
MODEL_MEDIUM_INPUT_PER_1K=...
MODEL_MEDIUM_OUTPUT_PER_1K=...
MODEL_STRONG_INPUT_PER_1K=...
MODEL_STRONG_OUTPUT_PER_1K=...
```

Never store these values in Git. Use the deployment platform's secret manager and rotate provider keys after suspected exposure.

## Deployment topology

```text
Browser → TLS reverse proxy / load balancer → FastAPI API instances
                                          ├→ PostgreSQL
                                          ├→ Redis (rate limits + telemetry + Celery)
                                          └→ OpenRouter / model providers
```

Terminate TLS at the reverse proxy and run Uvicorn with proxy headers enabled. Only trust forwarding headers from the proxy's IP range:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips=<reverse-proxy-ip-or-network>
```

Configure the proxy to redirect HTTP to HTTPS and to forward `Host` and `X-Forwarded-Proto`. `ENFORCE_HTTPS=true` provides a second application-level guard.

## Portable release artifacts and CI

The repository includes production-oriented Dockerfiles in `backend/` and `frontend/`. Both images run as non-root users. Build them from their respective directories:

```bash
docker build -t routealpha-api ./backend
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
  -t routealpha-web ./frontend
```

The frontend API URL is a build-time public value. Build a new frontend image whenever it changes. Run the API migration as a one-off release job before starting a new API image.

`.github/workflows/ci.yml` runs backend tests, a clean Alembic migration, and compilation, plus frontend lint, a Webpack production build, and a high-severity npm audit on pull requests and `main` pushes. Require these checks before merging a release branch.

## Database migrations

Production API startup does not create or alter tables. Deploy schema changes before rolling out the API:

```bash
cd backend
APP_ENV=production AUTO_CREATE_SCHEMA=false ./.venv/bin/python -m alembic upgrade head
```

Run migrations as a one-off release job with the same production database credentials used by the API. Do not run more than one migration job concurrently. For an existing local database created before Alembic, back it up first and use `alembic stamp head` only after verifying that its schema matches the initial migration.

## Health checks

- `GET /health` is a liveness probe and confirms the API process is reachable.
- `GET /health/ready` checks database connectivity and confirms provider configuration without exposing secrets. Configure the load balancer to send traffic only after it returns `200` with `status: ready`.
- `GET /internal/metrics` emits Prometheus-format HTTP request, status, latency, provider-call, and fallback metrics. It requires the `X-Metrics-Token` header and is intentionally excluded from the public API schema. Scrape it only from the monitoring network and alert on elevated 5xx, latency, fallback, and provider-error signals.

## Model release procedure

Model identifiers and account access vary by provider. Before changing a production tier:

1. Set the candidate in `MODEL_CHEAP`, `MODEL_MEDIUM`, or `MODEL_STRONG`.
2. Set that tier's input/output price values from the provider contract, per 1K tokens.
3. In a non-production environment, run one small authenticated inference request for that tier.
4. Confirm a successful response, observed cost, latency, and no fallback.
5. Promote the exact validated identifier and price values through configuration, not code.
6. Monitor fallback and provider-error rates after release; roll back the environment value if either regresses.

Tiers must use distinct model identifiers. The API validates this at startup so a fallback always has a distinct candidate.

## Upstream capacity controls

`MODEL_REQUEST_TIMEOUT_SECONDS` bounds each model-provider request. `MAX_INFERENCE_CONCURRENCY` limits the number of simultaneous provider calls in each API instance, and `INFERENCE_QUEUE_TIMEOUT_SECONDS` controls how long a request may wait for a slot. Requests exceeding that wait return `429` with `Retry-After` instead of accumulating indefinitely. Size these values from the provider quota, average request duration, and API replica count.

The frontend sends production-only security headers, including HSTS, CSP, clickjacking protection, MIME sniffing protection, and a restrictive permissions policy. Keep the frontend API URL on HTTPS in production; the CSP permits same-origin and HTTPS connections only.

The API also emits a correlation-safe `X-Request-ID`, no-store/cache and browser-protection headers. In production, its interactive API documentation and OpenAPI endpoint are disabled. Registration, contact, and inference routes have configurable SlowAPI limits backed by Redis; tune `REGISTER_RATE_LIMIT`, `CONTACT_RATE_LIMIT`, and `INFERENCE_RATE_LIMIT` to the actual product plan and provider quota.

## Backups and recovery

- Enable managed PostgreSQL point-in-time recovery and at least daily encrypted backups.
- Test restoring a backup into an isolated environment before launch.
- Back up only durable data (PostgreSQL); Redis rate-limit and telemetry keys are disposable operational state.
- Document the database restore owner, recovery target, and maximum acceptable data loss for the team.

## Release gate

Before public exposure, require all of the following:

- frontend lint and production build pass;
- backend tests and compilation pass;
- `npm audit --omit=dev --audit-level=high` has no high/critical findings;
- `/health` and `/health/ready` pass in the deployed environment;
- registration, email verification, login, 2FA/recovery-code, protected inference, fallback, and contact flows pass;
- Redis rate limiting is verified across two API instances;
- PostgreSQL backup restore has been tested;
- Alembic migration execution has been tested against a clean database;
- the configured model tiers have each completed a real provider smoke test; and
- deployment secrets, domains, CORS origins, and TLS settings have been reviewed.
