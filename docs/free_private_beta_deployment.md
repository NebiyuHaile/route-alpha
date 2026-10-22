# RouteAlpha free private-beta hosting stack

## Decision

Use the following stack for a public portfolio deployment, a demo environment, or a very small private beta:

| Concern | Chosen service | Why it fits RouteAlpha |
| --- | --- | --- |
| Next.js frontend | **Vercel Hobby** | Native Next.js deployment, CDN, preview deployments, and environment-variable support. |
| FastAPI API | **Render Free Web Service** | Runs the repository's Docker-based API image and supports an HTTP health check. |
| PostgreSQL | **Neon Free** | Managed serverless PostgreSQL, compatible with the production-only PostgreSQL configuration and Alembic migrations. |
| Redis | **Upstash Redis Free** | Managed TLS Redis for shared SlowAPI rate limits and Pareto-router telemetry. |
| Domain and TLS | Provider URLs initially; optional Cloudflare DNS plus a domain later | Every selected host provides HTTPS for its provider URL. A custom domain is optional and is not included in the no-cost plan. |

This is the best free combination for the current architecture because it preserves the production data-path shape—Next.js, FastAPI, PostgreSQL, and Redis—rather than weakening the application to use SQLite or process-local rate limiting.

## Scope and non-negotiable limitations

This is a **private-beta stack**, not the final public-production topology in [the production runbook](production_runbook.md).

- Render's free web services spin down after idle time, can take about a minute to wake up, and are limited to one instance. The API therefore has cold starts and cannot validate RouteAlpha's multi-replica behavior.
- Vercel Hobby is intended for personal and small-scale, non-commercial work. Do not use it for a commercial customer-facing launch.
- Render's free service blocks common outbound SMTP ports. RouteAlpha therefore sends verification and contact email through an HTTPS transactional-email provider, not Gmail SMTP.
- Do not run the optional Celery evaluator on this stack. There is no always-on free worker in this plan; leave the evaluator disabled until a worker-capable hosting tier is chosen.
- Neon Free has a bounded monthly compute allowance and 0.5 GB storage per project. Upstash Free has one database and 256 MB. Set provider budget alerts and keep the public demo traffic modest.
- The free services use public TLS endpoints. They do not provide the private database/Redis networking required by the full production runbook.

The first paid upgrade should be the API host. Move to an always-on, multi-instance API plan, then use its private network for PostgreSQL and Redis. Vercel, Neon, and Upstash can remain in place while that happens.

## Deployment architecture

```text
Browser
  │ HTTPS
  ▼
Vercel Hobby (Next.js)
  │ HTTPS + bearer token
  ▼
Render Free Web Service (FastAPI)
  ├── TLS ──► Neon Free (PostgreSQL)
  ├── TLS ──► Upstash Free (Redis)
  └── HTTPS ─► OpenRouter
```

Use the provider-issued URLs first:

```text
Frontend: https://<vercel-project>.vercel.app
API:      https://<render-service>.onrender.com
```

If a custom domain is later purchased, use `app.<domain>` for Vercel and `api.<domain>` for Render, then replace the values in the environment-variable steps below.

## Before creating services

1. Push the intended release commit to GitHub. Never push `.env` files, database URLs, API keys, JWT secrets, or TOTP encryption keys.
2. Validate locally with the repository checks in the README.
3. Create a dedicated OpenRouter key and a small spend limit for the demo. Verify the three selected model IDs with that account before deployment.
4. Generate secrets locally. Keep the output in a password manager or the deployment provider's secret store:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))" # AUTH_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" # TOTP_ENCRYPTION_KEY
python -c "import secrets; print(secrets.token_urlsafe(48))" # METRICS_TOKEN
```

## 1. Create PostgreSQL in Neon

1. Create a Neon Free project in a region near the chosen Render region.
2. Copy its pooled PostgreSQL connection string, using the `postgresql://...` form supplied by Neon.
3. Keep SSL/TLS enabled in the copied connection string.
4. Store the complete string as `DATABASE_URL` in Render. Do not put it in `render.yaml` or the Git repository.

Neon automatically scales idle compute to zero, so its first query can also add a small wake-up delay.

## 2. Create Redis in Upstash

1. Create one Upstash Redis Free database in a region near Render.
2. Copy its TLS connection URL, normally beginning with `rediss://`.
3. In Render, set **both** of these variables to that URL:

```text
RATE_LIMIT_STORAGE_URI=rediss://...
TELEMETRY_REDIS_URL=rediss://...
```

Do not use `memory://` in this deployment. The RouteAlpha production configuration intentionally rejects it.

## 3. Migrate the database once

Run the schema migration from a trusted local machine before the first API deployment. Export only the production variables needed by the application, or place them in an untracked local environment file.

```bash
cd backend
APP_ENV=production AUTO_CREATE_SCHEMA=false \
DATABASE_URL='<neon-postgresql-url>' \
OPENROUTER_API_KEY='<openrouter-key>' \
AUTH_SECRET_KEY='<auth-secret>' \
TOTP_ENCRYPTION_KEY='<fernet-key>' \
METRICS_TOKEN='<metrics-token>' \
RATE_LIMIT_STORAGE_URI='<upstash-rediss-url>' \
TELEMETRY_REDIS_URL='<upstash-rediss-url>' \
CORS_ORIGINS='https://placeholder.vercel.app' \
TRUSTED_HOSTS='placeholder.onrender.com' \
ENFORCE_HTTPS=true \
MODEL_CHEAP='<validated-model>' \
MODEL_MEDIUM='<validated-model>' \
MODEL_STRONG='<validated-model>' \
MODEL_CHEAP_INPUT_PER_1K='<price>' \
MODEL_CHEAP_OUTPUT_PER_1K='<price>' \
MODEL_MEDIUM_INPUT_PER_1K='<price>' \
MODEL_MEDIUM_OUTPUT_PER_1K='<price>' \
MODEL_STRONG_INPUT_PER_1K='<price>' \
MODEL_STRONG_OUTPUT_PER_1K='<price>' \
./.venv/bin/python -m alembic upgrade head
```

Use the model IDs and per-1K prices actually available to the OpenRouter account at deployment time. The API requires explicit production prices so the dashboard's cost estimates remain meaningful.

## 4. Deploy the FastAPI API on Render

1. In Render, create a new **Blueprint** from this repository. It will detect the root [`render.yaml`](../render.yaml).
2. Keep the generated service as a free web service. The blueprint uses `backend/Dockerfile`, `backend` as its Docker build context, and `GET /health/ready` as the deploy health check.
3. Fill every `sync: false` variable in Render's environment editor. Use the final Render URL for `TRUSTED_HOSTS` **without** `https://`, and the final Vercel URL for `CORS_ORIGINS` **with** `https://`.

```text
APP_ENV=production
AUTO_CREATE_SCHEMA=false
ENFORCE_HTTPS=true
DATABASE_URL=<Neon URL>
RATE_LIMIT_STORAGE_URI=<Upstash rediss URL>
TELEMETRY_REDIS_URL=<Upstash rediss URL>
OPENROUTER_API_KEY=<dedicated key>
AUTH_SECRET_KEY=<generated secret>
TOTP_ENCRYPTION_KEY=<generated Fernet key>
METRICS_TOKEN=<generated secret>
RESEND_API_KEY=<transactional-email API key>
EMAIL_SENDER=RouteAlpha <hello@your-verified-domain.example>
FRONTEND_BASE_URL=https://<vercel-project>.vercel.app
CORS_ORIGINS=https://<vercel-project>.vercel.app
TRUSTED_HOSTS=<render-service>.onrender.com
FORWARDED_ALLOW_IPS=*
```

4. Set all three model IDs and all six price fields. Do not set `CELERY_BROKER_URL` or start a Celery worker on the free stack.
5. Deploy and wait for Render's health check to pass.
6. Confirm:

```bash
curl -fsS https://<render-service>.onrender.com/health
curl -fsS https://<render-service>.onrender.com/health/ready
```

The first call after an idle period may take longer due to the free service wake-up. A non-2xx readiness response means the API cannot reach Neon, Upstash, or its required provider configuration; fix it before deploying the frontend.

## 5. Deploy the Next.js frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Add these production environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=https://<render-service>.onrender.com
NEXT_PUBLIC_SITE_URL=https://<vercel-project>.vercel.app
```

4. Deploy the production branch. The frontend container/build is already configured for standalone production output; Vercel can run the Next.js project directly.
5. Open the Vercel URL, register a throwaway account, sign in, and submit a short inference request.

If an inference call shows a browser CORS error, check that `CORS_ORIGINS` in Render exactly matches the deployed Vercel origin (scheme, hostname, and no trailing path), then redeploy the API.

## 6. Required post-deploy checks

| Check | Expected result |
| --- | --- |
| `GET /health` | `200` from Render. |
| `GET /health/ready` | `200` after Neon and Upstash are configured. |
| Register and login | Succeeds with a compliant password. |
| Failed login six times | Sixth request returns `429` and `Retry-After`. |
| TOTP-enabled login | Requires a valid OTP; non-enrolled accounts remain able to log in normally. |
| One short inference | Returns a response and route/cost/latency metadata. |
| Dashboard | Shows the new inference record. |
| `GET /internal/metrics` without token | `404`. |
| `GET /internal/metrics` with `X-Metrics-Token` | `200` from a trusted operator machine only. |

Do not publish the metrics token in a frontend variable or browser request.

## Provider references

- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Render free-instance limits](https://render.com/docs/free)
- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Neon pricing and Free plan limits](https://neon.com/pricing)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)

Provider free plans and limits change. Re-check these pages immediately before creating accounts or making an availability promise.
