# RouteAlpha production runbook

This is the practical, provider-neutral process for taking RouteAlpha from a validated repository to a live production service. It explains the order of operations and the reason for each one.

It assumes two public domains:

```text
https://app.example.com  → Next.js frontend
https://api.example.com  → FastAPI backend
```

Replace those example domains with real domains before deployment.

## 1. What “production” means

Production is not simply running `npm start` and Uvicorn on a public IP. A production RouteAlpha deployment has:

- HTTPS and controlled DNS for the frontend and API;
- an isolated PostgreSQL database for durable users, inference logs, and contact requests;
- a shared Redis service for rate limits, telemetry, and optional Celery work;
- deployment-managed secrets rather than `.env` files in the repository;
- a release process that runs migrations before serving the new API version;
- health checks, metrics, logs, alerts, backup recovery, and rollback procedures; and
- model identifiers and prices that have been validated with the actual provider account.

The product path is:

```text
Developer branch
  → pull request + CI
  → staging deployment
  → provider/model smoke test
  → database migration
  → production API rollout
  → frontend rollout
  → health checks and monitoring
```

## 2. Recommended topology

```text
Users
  │ HTTPS
  ▼
Frontend host / CDN ───────► Next.js web container
  │                              │
  │                              │ HTTPS API requests
  ▼                              ▼
DNS + TLS                    API load balancer
                                   │
                                   ▼
                            FastAPI container replicas
                              │       │        │
                              │       │        └── OpenRouter / model providers
                              │       └────────── Redis
                              └────────────────── PostgreSQL
```

Keep PostgreSQL and Redis private: only API/worker services should reach them. The browser should reach only the frontend and public API.

For an intentionally limited no-cost portfolio/private-beta deployment, see [the selected free hosting stack](free_private_beta_deployment.md). It uses public TLS data endpoints and a single sleeping API instance, so it is not a substitute for this production topology.

## 3. Create environments first

Maintain separate environments:

| Environment | Purpose | Data rule |
| --- | --- | --- |
| Local | Development and debugging | SQLite/demo data is acceptable. |
| Staging | Deployment and provider validation | Use isolated PostgreSQL/Redis and a separate provider key/budget. |
| Production | Real users | Managed PostgreSQL/Redis, backups, TLS, monitoring, and restricted secrets. |

Never point local or staging at the production database, Redis, SMTP account, or OpenRouter budget.

## 4. Provision infrastructure

Create these resources in the chosen cloud provider:

1. **Frontend host** for the Next.js image or managed Next.js deployment.
2. **API host** that can run the FastAPI container and expose a health check.
3. **Managed PostgreSQL** with encrypted storage, backups, point-in-time recovery, and a private network endpoint.
4. **Managed Redis** with TLS (`rediss://`) and private network access.
5. **Secret manager** for API keys, database URLs, signing/encryption keys, and SMTP credentials.
6. **DNS and TLS** for `app` and `api` subdomains.
7. **Monitoring target** capable of scraping Prometheus metrics or receiving equivalent alerts.

Use at least two API replicas once Redis is configured. The shared Redis limiter and telemetry store are specifically intended to keep behavior consistent across replicas.

## 5. Configure production secrets

Set all secrets in the deployment platform’s secret manager. Do not copy them into Git, Docker images, CI output, or public issue comments.

Generate long random values for `AUTH_SECRET_KEY` and `METRICS_TOKEN`. Generate the TOTP encryption key with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Use this production shape:

```env
APP_ENV=production
AUTO_CREATE_SCHEMA=false
DATABASE_URL=postgresql://<user>:<password>@<private-postgres-host>:5432/routealpha

OPENROUTER_API_KEY=<production-provider-key>
AUTH_SECRET_KEY=<long-random-secret>
TOTP_ENCRYPTION_KEY=<fernet-key>
METRICS_TOKEN=<long-random-secret>

RATE_LIMIT_STORAGE_URI=rediss://:<password>@<private-redis-host>:6379/0
TELEMETRY_REDIS_URL=rediss://:<password>@<private-redis-host>:6379/1
CELERY_BROKER_URL=rediss://:<password>@<private-redis-host>:6379/2
CELERY_RESULT_BACKEND=rediss://:<password>@<private-redis-host>:6379/2

CORS_ORIGINS=https://app.example.com
TRUSTED_HOSTS=api.example.com
ENFORCE_HTTPS=true
FORWARDED_ALLOW_IPS=<load-balancer-ip-or-network>

MODEL_CHEAP=<validated-openrouter-model>
MODEL_MEDIUM=<validated-openrouter-model>
MODEL_STRONG=<validated-openrouter-model>
MODEL_CHEAP_INPUT_PER_1K=<provider-contract-price>
MODEL_CHEAP_OUTPUT_PER_1K=<provider-contract-price>
MODEL_MEDIUM_INPUT_PER_1K=<provider-contract-price>
MODEL_MEDIUM_OUTPUT_PER_1K=<provider-contract-price>
MODEL_STRONG_INPUT_PER_1K=<provider-contract-price>
MODEL_STRONG_OUTPUT_PER_1K=<provider-contract-price>
```

The API refuses to start in production if key controls such as PostgreSQL, Redis, explicit CORS/host values, HTTPS enforcement, Fernet encryption, pricing, or metrics authentication are absent.

## 6. Build immutable release artifacts

Build an image for each commit that has passed CI. Tag it with the Git commit SHA, not only `latest`.

```bash
docker build -t registry.example.com/routealpha-api:<commit-sha> ./backend

docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
  -t registry.example.com/routealpha-web:<commit-sha> \
  ./frontend
```

The frontend API URL is embedded at build time because it is a `NEXT_PUBLIC_*` variable. If the API domain changes, rebuild and redeploy the frontend image.

## 7. Run migrations as a release job

Deploy database migrations before the API replicas that depend on them. Run exactly one migration job per release:

```bash
cd backend
APP_ENV=production AUTO_CREATE_SCHEMA=false \
  python -m alembic upgrade head
```

Rules:

- Take or verify a database backup before a destructive migration.
- Never run multiple migration jobs concurrently.
- Do not let the API create or alter production tables at startup.
- Prefer backward-compatible schema changes first, then deploy application code, then remove unused fields in a later release.

## 8. Deploy the API

Deploy the versioned API image with production secrets. The container starts Uvicorn on `PORT` (default `8000`) and runs as a non-root user.

The TLS proxy/load balancer must:

- terminate TLS and redirect HTTP to HTTPS;
- forward `Host` and `X-Forwarded-Proto`;
- use `GET /health` as a liveness probe;
- use `GET /health/ready` as the readiness probe; and
- wait for readiness before sending user traffic to a new replica.

Use rolling deployment or blue/green deployment. Do not terminate every healthy replica at once.

## 9. Deploy the frontend

Deploy the versioned frontend image after the API is healthy. The frontend has production security headers, including CSP, HSTS, no-frame protection, and a restrictive permissions policy.

Set the public values at build time:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_SITE_URL=https://app.example.com
```

After deployment, confirm browser requests from `app.example.com` reach `api.example.com` without CORS failures.

## 10. Perform release smoke tests

Run these checks from a trusted operator machine or CI job after deployment:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/health/ready
curl -sSI https://app.example.com
```

Then validate the product flows:

1. Register a throwaway account using a compliant password.
2. Log in and call `GET /auth/me` with the returned bearer token.
3. Enroll 2FA, confirm login fails without an OTP, then succeeds with a valid OTP.
4. Submit a small authenticated inference request.
5. Confirm route key, model, cost, latency, and fallback metadata are returned.
6. Verify the inference appears in the dashboard.
7. Submit a contact request and confirm it persists; verify notification delivery separately.
8. Confirm a sixth failed login receives `429` and `Retry-After`.
9. Confirm two API replicas share the login/contact/inference rate-limit behavior through Redis.

Run only intentionally small inference prompts for these checks so the release test has a bounded provider cost.

## 11. Configure monitoring and alerts

Scrape the protected metrics endpoint from the monitoring network:

```bash
curl -H "X-Metrics-Token: <metrics-token>" \
  https://api.example.com/internal/metrics
```

At a minimum, alert on:

| Signal | Example action |
| --- | --- |
| API 5xx rate rises | Inspect logs by `X-Request-ID`; consider rollback. |
| Readiness failure | Remove the replica from traffic and inspect database/Redis reachability. |
| Provider-call failure or fallback spike | Check OpenRouter/model availability; disable or replace the affected tier. |
| p95 latency rises | Check provider latency, concurrency limit, and queue rejection count. |
| Unexpected 429 increase | Review product traffic, abuse, provider quota, and configured limits. |
| Database backup failure | Treat as a release blocker until corrected. |

Keep logs structured where possible and do not log bearer tokens, passwords, TOTP secrets, full credentials, or raw provider error bodies.

## 12. Backups and recovery

Before launch:

1. Enable point-in-time recovery and daily encrypted PostgreSQL backups.
2. Record the recovery point objective (acceptable data loss) and recovery time objective.
3. Restore a backup into an isolated database.
4. Start a temporary API against that restored copy and verify users/logs can be read.
5. Record the test date and operator in the release log.

Redis rate-limit and telemetry state can be recreated. PostgreSQL is the durable source of truth and must be recoverable.

## 13. Rollback procedure

If the release causes increased errors, broken authentication, unavailable inference, or unacceptable cost/latency:

1. Stop further rollout immediately.
2. Route traffic back to the last healthy frontend/API image tags.
3. Do **not** roll back the database automatically if a migration has already run; use a tested forward fix or a migration-specific rollback plan.
4. Check `/health/ready`, error metrics, Redis connectivity, and provider availability.
5. Preserve logs and request IDs needed for diagnosis.
6. Rotate any secret that may have been exposed during investigation.
7. Write a short incident record before retrying the release.

## 14. Operator checklist

Use this checklist for every public production release:

- [ ] Pull request CI is green.
- [ ] Docker images are built, tagged by commit SHA, and scanned by the platform if available.
- [ ] Production secrets are present only in the secret manager.
- [ ] Exact model IDs and prices are provider-validated.
- [ ] Database backup is current.
- [ ] Exactly one migration job completed successfully.
- [ ] New API replicas are ready before receiving traffic.
- [ ] Frontend points at the correct HTTPS API domain.
- [ ] Health, readiness, auth, 2FA, inference, dashboard, contact, and rate-limit smoke checks pass.
- [ ] Metrics scraping and alerts work.
- [ ] Rollback image tags and database recovery owner are known.

## 15. What requires a platform decision

This repository is ready to use the process above, but these items depend on the platform you choose:

- exact container deployment configuration;
- managed PostgreSQL and Redis creation;
- DNS/TLS records;
- secret-manager setup;
- monitoring and alert integration; and
- the first staging and production rollout.

Once a platform is chosen, create a platform-specific deployment file or infrastructure configuration that maps its services to this runbook. Keep the generic controls in this document unchanged.

## 16. Current product security boundary

RouteAlpha's browser session currently keeps a bearer token in `localStorage`. The production headers reduce browser attack surface, but they do not make `localStorage` equivalent to an `HttpOnly` cookie. Before handling highly sensitive or regulated workloads, plan a dedicated authentication evolution to a same-origin BFF or secure cookie/refresh-token design with CSRF protection, token rotation, and tenant-scoped authorization.

The current platform is suitable for a controlled private beta once this runbook's deployment and recovery checks are complete. A broader multi-tenant launch also needs tenant isolation, prompt-retention controls, audit events, and budget enforcement.
