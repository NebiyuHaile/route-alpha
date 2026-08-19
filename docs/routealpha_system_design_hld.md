# RouteAlpha — System Design / High-Level Design Interview Guide

## 1. Executive summary

RouteAlpha is an AI inference-routing platform. Instead of sending every prompt to one model, it selects a model **tier** (`cheap`, `medium`, or `strong`) that balances a caller's cost, latency, and quality preferences. It then executes the request through OpenRouter/LiteLLM, retries a defined fallback order when an upstream attempt fails, logs the outcome, and exposes cost, latency, model, route, and fallback analytics.

The current implementation is a full-stack MVP: a Next.js client, a FastAPI API, SQLAlchemy persistence (SQLite locally and PostgreSQL intended for production), a local ONNX semantic classifier, and an optional Celery evaluator. The production-scale design below keeps the same product behavior but separates the latency-sensitive inference control plane from asynchronous evaluation and analytics work.

### One-minute interview pitch

> “RouteAlpha is a policy-driven LLM gateway. A client authenticates, submits a prompt with a priority or explicit cost/latency/accuracy weights, and the API classifies the workload locally. It scores the available tiers using live cost and latency telemetry plus task-specific quality ratings, calls the selected provider/model, and transparently falls back if that call fails. Every decision and execution outcome is recorded, enabling an analytics dashboard and a feedback worker that can reduce a model's quality prior when evaluations show sustained failures. The key design principle is graceful degradation: semantic routing, dynamic telemetry, and evaluation improve decisions, but a static router and ordered fallback path keep inference available when optional components fail.”

---

## 2. Problem statement

An application using LLMs usually faces three conflicting objectives:

- **Cost:** inexpensive models are appropriate for simple or high-volume work.
- **Latency:** user-facing workloads need predictable response time.
- **Quality:** complex reasoning, code, or structured outputs may require a stronger model.

Hard-coding one provider/model either overpays for simple requests or underperforms on difficult ones. RouteAlpha makes this choice centrally, returns an auditable explanation, and captures the operational data needed to improve it.

### Goals

1. Route each request to a suitable model tier based on policy, observed performance, and task signal.
2. Keep requests available when a provider/model fails through ordered fallback.
3. Make routing explainable: expose chosen and resolved tier, route reason, semantic signal, candidate scores, latency, cost, and attempts.
4. Persist request and outcome data for product analytics and later quality feedback.
5. Provide authenticated operator workflows for testing and observing routing.
6. Degrade safely when optional components (ONNX model, evaluator, telemetry signal) are unavailable.

### Non-goals for the current MVP

- Token streaming to the browser.
- Guaranteed provider-side quotas, rate limiting, or per-tenant budget enforcement.
- A distributed/shared telemetry layer.
- Strong tenant isolation and user-scoped analytics.
- Automated model benchmarking or online experimentation with statistical guardrails.
- Exactly-once execution across client retries.

---

## 3. Requirements an interviewer will expect

### Functional requirements

| Area | Requirement |
| --- | --- |
| Authentication | Register, log in, issue a short-lived signed bearer token, and reject unauthenticated requests. |
| Inference | Accept a prompt, optional task type, priority, optional explicit routing policy, and optional expected JSON Schema. |
| Routing | Choose one of `cheap`, `medium`, `strong`; return the choice and rationale. |
| Provider execution | Call the selected model through a provider abstraction. |
| Resilience | Retry using an ordered list of distinct fallback models/tiers after a failed attempt. |
| Observability | Persist prompt, selected/resolved routes, attempts, fallback state, model, token estimates, estimated cost, latency, and response. |
| Analytics | Provide volume, average latency, cost, route/model usage, fallback rate, and recent-request views. |
| Quality feedback | Evaluate outputs asynchronously; use structured-output validation where possible and an LLM judge otherwise. |
| Product surfaces | Marketing site, auth, inference playground, dashboard, and contact lead capture. |

### Non-functional requirements

| Dimension | MVP behavior | Production target |
| --- | --- | --- |
| Availability | Best-effort API and provider fallback | Define a 99.9% gateway availability SLO excluding provider outages; multi-AZ API and datastore. |
| Latency | Dominated by synchronous upstream model call | Track p50/p95/p99 separately by model and tier; set a per-request deadline and fallback budget. |
| Durability | SQL write after successful model call | Highly available PostgreSQL, migrations, backups, and an outbox/event stream. |
| Scalability | Single-process telemetry; synchronous API path | Horizontally scaled stateless APIs; Redis/shared metrics; async analytics/evaluation. |
| Security | JWT bearer auth, password hashing, CORS allowlist | Secret manager, key rotation, TLS, rate limits, audit trail, tenant isolation, data controls. |
| Explainability | Route reason and candidate scores returned/logged | Versioned policies, model catalog versions, decision IDs, trace correlation, replay capability. |

---

## 4. Assumptions and capacity model

State assumptions explicitly in an interview because model routing is highly workload dependent.

| Assumption | Example planning value | Why it matters |
| --- | --- | --- |
| Active tenants | 100 initially, thousands later | Drives isolation, quotas, and analytics partitioning. |
| Average request rate | 10 RPS initially | Determines API, connection-pool, and provider concurrency. |
| Peak request rate | 10× average = 100 RPS | Size for bursts, not the average. |
| Prompt size | 1–5K input tokens, bounded by API character limit | Affects provider cost, timeout, and log volume. |
| Output size | up to 300 generated tokens in the current call configuration | Affects response time and cost. |
| End-to-end model latency | 1–10 seconds depending on model/provider | Makes synchronous model execution the critical path. |
| Inference-log retention | 30–90 days hot, longer aggregate retention | Prompts/responses are expensive and may contain sensitive data. |

At 100 RPS and a 5-second average upstream response time, roughly **500 concurrent upstream calls** may be active (Little's Law: `concurrency ≈ arrival rate × response time`). This is why a production design needs bounded concurrency, provider-specific queues/rate limits, cancellation, and timeouts rather than unbounded thread or connection growth.

---

## 5. Architecture overview

```text
                           ┌──────────────────────────────┐
                           │       Browser / Next.js       │
                           │ Landing · Auth · Infer · Dash │
                           └──────────────┬───────────────┘
                                          │ HTTPS + Bearer JWT
                                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         RouteAlpha API / control plane                       │
│                                                                            │
│  Auth middleware → request validation → semantic classifier               │
│                          │                         │                       │
│                          │                         ▼                       │
│                          │                   Pareto router                 │
│                          │                 (policy + telemetry + quality)  │
│                          ▼                         │                       │
│                   PostgreSQL ◄──── execution log ◄─┘                       │
│                          │                         │                       │
│                          │                         ▼                       │
│                   Analytics queries           Provider adapter             │
└──────────────────────────┼─────────────────────────┼───────────────────────┘
                           │                         │
                           ▼                         ▼
               Celery evaluator + broker      LiteLLM / OpenRouter
               JSON Schema or LLM judge        ├─ cheap model
               updates quality ratings          ├─ medium model
                                                └─ strong model
```

### Component responsibilities

| Component | Responsibility | Current implementation |
| --- | --- | --- |
| Next.js frontend | Product UI; stores a client session; sends authorized API calls; renders inference and analytics metadata. | `frontend/` routes and components. |
| FastAPI gateway | API boundary, CORS, auth dependency, request validation, orchestration, persistence, and endpoint responses. | `backend/app/main.py`. |
| Semantic router | Locally classifies a prompt by cosine similarity against category exemplars. | ONNX Runtime CPU via `EmbeddingRouter`. |
| Pareto router | Scores every tier using normalized cost, latency, and accuracy values. | `ParetoRouter` + in-memory sliding telemetry. |
| Static router | Provides deterministic routing when dynamic routing fails. | `backend/app/router.py`. |
| Provider adapter | Maps tiers to model identifiers, invokes LiteLLM/OpenRouter, estimates tokens/cost, and applies fallback. | `backend/app/llm_service.py`. |
| Transactional datastore | Stores users, contact leads, inference logs, and evaluator-adjusted quality ratings. | SQLAlchemy; SQLite locally/PostgreSQL intended in production. |
| Analytics service | Aggregates logs for dashboard endpoints. | SQL `COUNT`, `SUM`, `AVG`, `GROUP BY`. |
| Evaluation worker | Periodically judges recent responses and persists quality adjustments. | Optional Celery task and Redis-compatible broker. |
| SMTP integration | Sends a notification after storing a contact request. | `backend/app/email_utils.py`. |

---

## 6. Core request flow: inference

### Sequence

```text
1. Client → POST /infer { prompt, task_type?, priority?, routing_policy?, expected_json_schema? }
2. API → authenticate Bearer JWT and verify active user in database
3. API → local ONNX classifier: prompt → semantic category + similarity (best effort)
4. API → choose task type: explicit task type, or semantic category when task type is general
5. API → build routing policy from explicit weights or priority preset
6. API → load persisted task/model accuracy overrides from database
7. API → score cheap/medium/strong using telemetry + quality priors
8. API → LiteLLM/OpenRouter call to selected tier
9. Provider error? → attempt the configured fallback order, skipping duplicate models
10. API → record current model cost/latency in telemetry
11. API → persist full inference log in SQL
12. API → return output plus routing and execution metadata
13. Optional worker → later evaluates response and updates quality ratings
```

### API contract

`POST /infer` requires `Authorization: Bearer <token>`.

```json
{
  "prompt": "Explain why this SQL query is slow.",
  "task_type": "general",
  "priority": "balanced",
  "routing_policy": {
    "cost_weight": 0.34,
    "latency_weight": 0.33,
    "accuracy_weight": 0.33
  },
  "expected_json_schema": null
}
```

`prompt` is required and constrained to 1–100,000 characters. `task_type` and `priority` are strings rather than strict enums in the current API. `code_generation`, `creative_writing`, `classification`, and `summarization` are configured semantic categories; the UI additionally exposes `general`, `education`, `coding`, and `reasoning`. This distinction is important: the semantic classifier's categories are routing signals, not a complete API enum.

The response includes both the requested decision and the execution result:

```json
{
  "request_id": "uuid",
  "route_key": "medium",
  "route_reason": "Pareto dynamic routing selected medium for code_generation",
  "resolved_route_key": "medium",
  "fallback_used": false,
  "fallback_reason": null,
  "attempted_routes": ["medium"],
  "attempted_models": ["openrouter/openai/gpt-4o-mini"],
  "model_used": "openrouter/openai/gpt-4o-mini",
  "task_type": "code_generation",
  "priority": "balanced",
  "estimated_input_tokens": 25,
  "estimated_output_tokens": 180,
  "estimated_cost_usd": 0.000123,
  "latency_ms": 1520.3,
  "semantic_category": "code_generation",
  "semantic_similarity": 0.88,
  "pareto_score": -0.31,
  "candidate_scores": { "cheap": {}, "medium": {}, "strong": {} },
  "response": "..."
}
```

### Why this is a control-plane design

The gateway does not itself generate tokens. It makes a decision, calls a model provider, records the result, and exposes an audit trail. That enables model changes and policy changes without modifying every downstream product feature.

---

## 7. Routing design

### 7.1 Model catalog and tiers

The tier is the stable product abstraction; the concrete model is configuration. The current catalog maps `cheap` to Gemini Flash Lite and both `medium` and `strong` to GPT-4o mini. This means the system can exercise tier-level routing and observability today, but `medium` versus `strong` is not yet a meaningful model-quality comparison. Production should benchmark and map each tier to distinct models, context windows, and capabilities.

```text
cheap  → lowest price / fastest expected response
medium → balanced default
strong → highest expected quality
```

### 7.2 Semantic classification

At startup the API tries to load `model.onnx` and `tokenizer.json`. For a request it:

1. tokenizes the prompt;
2. runs ONNX Runtime on CPU;
3. attention-mask mean-pools hidden states;
4. L2-normalizes the embedding;
5. computes dot products with precomputed normalized category vectors; and
6. uses the maximum cosine similarity as the semantic match.

This is intentionally local: it adds no external LLM call and no per-request provider cost. If model assets are absent or inference fails, the classifier returns no match and the API continues safely.

### 7.3 Policy and Pareto scoring

The request can supply a validated weight vector:

```text
cost_weight + latency_weight + accuracy_weight = 1.0
each weight ∈ [0, 1]
```

If absent, RouteAlpha derives a policy from priority:

| Priority | Cost | Latency | Accuracy | Product intent |
| --- | ---: | ---: | ---: | --- |
| `cheap` | 0.80 | 0.15 | 0.05 | Minimize spend. |
| `fast` | 0.15 | 0.80 | 0.05 | Minimize latency. |
| `quality` | 0.05 | 0.10 | 0.85 | Favor quality. |
| `balanced` / default | 0.34 | 0.33 | 0.33 | Balanced trade-off. |

For each candidate tier, RouteAlpha takes the moving average of observed cost per 1K tokens and latency. It min-max normalizes those values over the candidates:

```text
x_norm = (x - min(x)) / (max(x) - min(x))
```

When all candidates have equal values, normalization is zero for each candidate. The router chooses the **lowest** score:

```text
score = cost_weight × normalized_cost
      + latency_weight × normalized_latency
      - accuracy_weight × accuracy_rating
```

The negative accuracy term means a higher quality rating lowers the score. Candidate input values and scores are returned to the caller and logged, so the decision is auditable.

### 7.4 Static fallback routing

If semantic or Pareto routing fails, the system falls back to deterministic rules:

- explicit `cheap` → cheap;
- explicit `fast` → cheap;
- explicit `quality` → strong;
- `coding` or `reasoning` → strong;
- short prompt → cheap;
- medium prompt → medium;
- long prompt → strong.

This fallback is a key availability feature: an optional signal should never turn into an inference outage.

### 7.5 Execution fallback

The provider adapter uses ordered fallback chains:

```text
cheap  → cheap → medium → strong
medium → medium → strong → cheap
strong → strong → medium → cheap
```

It skips duplicate concrete model identifiers. That prevents pointless retries when multiple tiers map to the same provider/model. Each attempt is retained in `attempted_routes` and `attempted_models`; the response separates the initially selected `route_key` from the successfully executed `resolved_route_key`.

### 7.6 Feedback loop

The optional Celery worker periodically samples recent inference logs:

- when an expected JSON Schema was supplied, it parses the response and validates it locally;
- otherwise, it asks a configured judge model for a strict `Pass`/`Fail` verdict;
- it groups results by `(model_used, task_type)`;
- if the failure rate passes the configured threshold, it reduces the persisted task-specific accuracy rating; and
- the next inference loads that persisted rating before scoring.

The design purpose is closed-loop routing: observed quality affects future routing, rather than keeping quality priors static forever.

### Important limitations to say out loud

- Current telemetry is an in-memory, bounded sliding window per API process. It resets on restart and differs across replicas.
- Quality evaluation is batch-based and only lowers ratings after a threshold; it does not yet learn a full calibrated accuracy model.
- The evaluator is optional and needs a broker plus provider credentials for open-ended judging.
- A judge model introduces its own cost and potential bias; structured validation is more deterministic where possible.

---

## 8. Data design

### Primary entities

| Table | Primary key | Important columns | Purpose |
| --- | --- | --- | --- |
| `users` | `user_id` | email (unique/indexed), password_hash, active state, profile | Identity and authorization check. |
| `inference_logs` | `request_id` | prompt, response, task/priority, selected/resolved tier, attempts, model, token/cost/latency, schema, time | Operational audit record and analytics source. |
| `model_task_performance` | auto-increment ID | model, task type, accuracy rating, sample/failure counts | Evaluator feedback read during routing. |
| `contact_requests` | `request_id` | lead details, use case, message, time | Product lead capture. |

### Data lifecycle and privacy

Inference logs deliberately store the prompt and full response to support debugging and evaluation. In a production interview answer, immediately add the controls that are not yet implemented:

- encrypt storage and transport;
- classify prompts/responses as potentially sensitive customer data;
- define configurable retention and deletion policies;
- redact or tokenize known sensitive data before persistence where appropriate;
- restrict raw-log access via tenant RBAC and audit it;
- separate analytics aggregates from raw content; and
- support data export/deletion requirements.

### Indexing and query patterns

The current schema indexes request IDs, user IDs, emails, and performance dimensions. For production analytics, add composite indexes aligned with actual queries, for example:

```text
inference_logs(tenant_id, created_at DESC)
inference_logs(tenant_id, route_key, created_at DESC)
inference_logs(tenant_id, model_used, created_at DESC)
model_task_performance(model_used, task_type)
```

For high volume, keep PostgreSQL as the source of truth, partition raw logs by time/tenant, and move pre-aggregated metrics to an OLAP store or materialized views. The dashboard should read aggregates, not scan a growing raw-log table on every refresh.

### Transaction boundaries

The current flow persists an inference only after a provider call succeeds. This avoids logs for rejected requests but means an API crash after the upstream execution and before the SQL commit can cause an unlogged response. A production version should use:

- a client-provided idempotency key;
- an execution state record (`received`, `running`, `completed`, `failed`);
- an outbox event written with the log transaction; and
- a durable event consumer for analytics/evaluation.

That makes retries observable and reduces duplicate model charges.

---

## 9. Authentication and authorization

### Current flow

1. `POST /auth/register` validates identity fields, hashes the password, stores the user, and returns a token.
2. `POST /auth/login` verifies the password and returns a token.
3. The token is an HS256 JWT containing subject, email, and expiry (24 hours by default).
4. Protected endpoints accept `Authorization: Bearer <access_token>`.
5. The API validates signature and expiry and rechecks that the user still exists and is active.
6. The frontend restores the session by calling `/auth/me`; it clears local session state on 401.

Passwords use PBKDF2-HMAC-SHA256 with a random salt and 120,000 iterations, and comparison uses constant-time comparison.

### Current security boundary and production gaps

The current frontend keeps the bearer token in `localStorage`, which is convenient for an MVP but exposed to XSS if the application is compromised. A stronger production posture is:

- use short-lived access tokens plus refresh-token rotation in secure, `HttpOnly`, `SameSite` cookies, or a BFF pattern;
- keep the signing key in a secret manager and rotate keys (`kid`-based verification);
- use asymmetric JWTs if multiple independent services must verify tokens;
- add organization/tenant ID and roles/entitlements to the authorization model;
- scope every inference and analytics query by tenant and enforce quotas/budgets;
- add login/register rate limiting, email verification, password-reset flow, and abuse controls;
- narrow CORS origins per deployment and require TLS everywhere.

**Important interview observation:** analytics queries in the current MVP are authenticated but are not filtered by user or tenant. Multi-tenant production must add `tenant_id` to all relevant records and enforce it in every query.

---

## 10. Reliability and failure handling

### Failure matrix

| Failure | Current behavior | Production improvement |
| --- | --- | --- |
| Missing/invalid bearer token | 401 response. | Keep; add rate limiting and richer audit events. |
| ONNX assets absent or classifier errors | Dynamic semantic signal is skipped. | Monitor classifier availability; load model on readiness path. |
| Pareto scoring exception | Falls back to static router. | Alert on degraded-routing rate; version policies. |
| Selected model/provider error | Attempts ordered fallback models. | Retry only retriable classes; exponential backoff with jitter; cap total request deadline. |
| All providers fail | Returns 500 with attempt summary. | Return structured 502/503; avoid leaking provider internals; expose a request ID. |
| Database failure during logging | Inference request fails in current implementation. | Decouple analytics persistence with outbox/queue or a non-blocking log pipeline. |
| Celery/broker unavailable | Core inference still works; feedback stops. | Health checks, dead-letter queue, idempotent jobs, alerts. |
| SMTP failure | Contact endpoint currently can fail after lead save. | Send notification asynchronously from an outbox so the stored lead still returns success. |

### Timeout and retry policy for a production gateway

Define a total client deadline, for example 15 seconds for non-streaming requests. Allocate it:

```text
auth + routing: < 100 ms
primary provider attempt: 8–10 s
fallback attempt: remaining 4–6 s
SQL logging: asynchronous or < 100 ms
```

Use provider-specific circuit breakers. When a provider/model shows high error rate or high p95 latency, temporarily mark it unhealthy and route around it. Do not retry invalid requests, auth errors, safety rejections, or deterministic 4xx provider errors.

### Idempotency

Model calls can charge money and have side effects in tool-using workflows. The API should accept an `Idempotency-Key` per tenant, store a request fingerprint/status, and return the original completed result for a duplicate request instead of calling the model again.

---

## 11. Scalability plan

### What scales today

The FastAPI API is mostly stateless apart from process-local telemetry and can conceptually be replicated. SQL is shared state; the provider does the expensive generation work.

### What prevents horizontal scale today

1. Telemetry is process-local, so replicas make different decisions from different rolling windows.
2. Evaluation is periodic SQL polling instead of event-driven work.
3. Analytics run direct aggregate queries against raw logs.
4. Model calls are synchronous within a thread offload; concurrency must be bounded carefully.
5. Logs have no tenant boundary or retention/partitioning strategy.

### Production evolution

```text
CDN/WAF/API Gateway
        │
        ▼
Stateless inference API replicas ──► Redis
        │                            ├─ distributed telemetry windows
        ├──────────────────────────► ├─ rate limits / budgets
        │                            └─ circuit breaker health
        ▼
Provider adapter pool ─────────────► multiple LLM providers
        │
        ├─ synchronous response path
        └─ outbox/event stream ─────► queue/stream ─► workers
                                             ├─ evaluator
                                             ├─ analytics aggregation
                                             ├─ billing/usage
                                             └─ notifications
                                                     │
                                      PostgreSQL ◄───┘
                                      OLAP/warehouse for dashboard
```

### Scaling choices and rationale

| Concern | Design choice | Rationale |
| --- | --- | --- |
| API compute | Horizontally scale stateless containers behind a load balancer. | Separates availability from traffic spikes. |
| Shared router state | Redis or a time-series/feature store for telemetry and model health. | Every replica sees the same routing signal. |
| Provider protection | Per-provider/token/model semaphores and queues. | Prevents one provider outage or quota from consuming all API capacity. |
| Durable writes | PostgreSQL with pooling, replicas, backups, and migrations. | Strong transactional store for identities and request state. |
| Analytics | Event stream plus aggregate tables/OLAP. | Keeps dashboard reads off the inference critical path. |
| Evaluation | Async workers with a queue and dead-letter support. | Expensive/slow judging cannot block user inference. |
| Model metadata | Versioned model registry/config service. | Makes catalog and policy updates auditable and safely rollable. |

---

## 12. Observability, metrics, and SLOs

### Three observability layers

1. **Request traces:** correlation/request ID across browser, API, provider call, database write, and worker.
2. **Metrics:** low-cardinality counters and histograms for alerts and SLOs.
3. **Logs/events:** structured routing decisions and error details for debugging/replay.

### Metrics to track

| Category | Examples |
| --- | --- |
| Traffic | requests/sec, concurrent requests, request size, output size. |
| Latency | gateway p50/p95/p99, provider p50/p95/p99 by model, routing overhead, DB time. |
| Reliability | success rate, 4xx/5xx, timeout rate, fallback rate, all-fallback-failed rate, circuit state. |
| Cost | estimated/actual tokens and cost by tenant/model/task/route; budget utilization. |
| Routing | decision distribution, selected-vs-resolved route, score distribution, semantic-confidence distribution. |
| Quality | evaluator pass rate, schema-valid rate, rating drift, sample coverage, judge failure rate. |
| Security | auth failures, registration/login rates, suspicious traffic, secret/key rotation status. |

### Suggested SLOs

| SLI | Example SLO |
| --- | --- |
| Gateway availability | 99.9% of valid requests receive a non-5xx gateway response monthly, excluding confirmed upstream provider outage policy. |
| Routing correctness | 100% of completed requests include a decision/audit record. |
| Latency | p95 gateway overhead < 100 ms; p95 total latency tracked per model rather than one misleading global target. |
| Durability | 99.99% of completed executions have a persisted log/event within a defined asynchronous window. |
| Evaluation | 95% of eligible samples evaluated within 30 minutes, excluding judge provider outage. |

### Dashboard evolution

The existing dashboard shows total requests, cost, latency, model/route distributions, fallback metrics, and recent requests. Production should add time ranges, tenant scoping, request outcome/error class, p95/p99, actual provider billing reconciliation, policy/model versions, and anomaly alerts.

---

## 13. Security, compliance, and abuse prevention

### Threat model

| Threat | Mitigation |
| --- | --- |
| Stolen bearer token | Short TTL, refresh rotation, secure cookie/BFF, revocation/session store, anomaly detection. |
| Credential stuffing | Login throttles, IP/device signals, email verification, MFA for operators. |
| Prompt injection / unsafe content | Provider safety settings, content policy layer, allowlisted tools, output handling constraints. |
| Cost abuse | Per-tenant/user quotas, token caps, budget alerts, rate limits, idempotency. |
| Cross-tenant data exposure | Mandatory tenant ID filters, row-level security, authorization tests, separate encryption keys for high-sensitivity tenants. |
| Sensitive prompt logging | Configurable retention, redaction, encryption, access audit, opt-out/zero-retention mode. |
| Secret leakage | Secret manager, no keys in code/logs, key rotation, least privilege. |
| Upstream outage | Multi-provider routing, circuit breakers, graceful 503 with request ID. |

### Data governance questions to ask a customer

- Are prompts/responses allowed to leave the region or be retained by the model provider?
- Do any inputs contain PII, PHI, payment data, source code, or regulated data?
- Is zero data retention required?
- What tenant-level budget, region, provider, or model restrictions apply?
- Is human review permitted for quality evaluation?

---

## 14. Deployment and operations

### Local development

- FastAPI runs on `127.0.0.1:8000`.
- Next.js runs on `localhost:3000`.
- SQLite enables a quick local demo; PostgreSQL is the intended production datastore.
- The local classifier is optional; static routing remains available without model artifacts.

### Production deployment topology

| Layer | Recommended deployment |
| --- | --- |
| Edge | CDN/WAF/API gateway with TLS termination and request-size/rate controls. |
| Web | Next.js deployment with environment-specific API URL. |
| API | Containerized FastAPI service, multiple replicas, readiness/liveness checks, autoscaling. |
| Worker | Separate evaluator/notification/aggregation worker deployment. |
| Broker/cache | Managed Redis or equivalent, highly available where required. |
| Database | Managed PostgreSQL with backups, point-in-time recovery, migration pipeline, read replicas as needed. |
| Secrets | Managed secret store injected at runtime; never commit `.env` files. |
| Observability | Central logs, metrics, tracing, alerting, and dashboard. |

### Release strategy

1. Version the model catalog and routing policy.
2. Test routing deterministically with fixture telemetry and provider mocks.
3. Shadow-score new policies without changing traffic.
4. Canary by tenant or small traffic percentage.
5. Compare cost/latency/quality/fallback metrics against baseline.
6. Roll forward or revert using a configuration change, not a code deployment when possible.

---

## 15. Key tradeoffs and how to explain them

| Decision | Benefit | Cost / tradeoff |
| --- | --- | --- |
| Local semantic classifier | Low-latency, no per-request LLM classification cost, provider-independent. | Requires model asset lifecycle and may be less accurate than a large classifier. |
| Weighted score instead of hard rules | Transparent, tunable cost/latency/quality tradeoff. | Requires trustworthy priors/telemetry and can be gamed by noisy data. |
| Tier abstraction | Decouples product policy from provider/model names. | Tiers need rigorous benchmarking to remain meaningful. |
| Ordered fallback | Stronger availability during model failures. | Can increase tail latency and cost; needs total deadline and error taxonomy. |
| Synchronous inference response | Simple UX and immediate answer. | Model call dominates capacity and ties up request resources. |
| SQL inference log | Simple auditability and dashboard source. | Raw prompt/response storage can become expensive and sensitive. |
| LLM-as-a-judge | Covers open-ended quality where schemas cannot. | Adds cost, latency, bias, and evaluator failure modes. |
| JWT auth | Simple stateless API authentication. | Revocation/rotation/session security needs more design for production. |

---

## 16. Current implementation vs. production-ready target

| Area | Current RouteAlpha | Next production step |
| --- | --- | --- |
| Routing signal | Local semantic match + Pareto score + static fallback. | Shared telemetry, calibration, confidence thresholds, experimentation. |
| Model catalog | Configured in application code; medium/strong currently use the same model. | Versioned registry; distinct benchmarked models; per-tenant allowlists. |
| Telemetry | In-memory per process, bounded to 200 samples by default. | Redis/time-series backed, multi-replica, decayed/weighted windows. |
| Fallback | Sequential ordered attempts, duplicate model skip. | Error classification, deadline budget, circuit breakers, provider hedging when justified. |
| Persistence | Direct SQLAlchemy logging after inference. | Async/event-driven log pipeline, idempotency, partitioning and retention. |
| Analytics | SQL aggregates over all logs. | Tenant-scoped OLAP aggregates and live alerting. |
| Evaluation | Optional periodic Celery task. | Event-driven queue, calibrated rubrics, human/ground-truth sampling. |
| Authentication | HS256 JWT, PBKDF2 passwords, browser localStorage session. | Tenant RBAC, secure cookie/BFF, key rotation, abuse protection. |
| Availability | Single local API process practical for demo. | Load-balanced replicas, HA data plane, SLOs/runbooks. |

---

## 17. Recommended interview walkthrough

Use this order when presenting the system on a whiteboard:

1. **Clarify scope:** “Are we building a gateway for one product team or a multi-tenant platform? What are the request volume, latency, model-quality, and data-retention requirements?”
2. **State the core abstraction:** “A stable route tier maps to a changeable model catalog.”
3. **Draw the synchronous path:** client → auth → classifier → router → provider adapter/fallback → response.
4. **Draw the durable path:** inference log/outbox → SQL/event stream → analytics and evaluator workers.
5. **Explain routing math:** normalize current cost/latency, blend with policy weights and task-model accuracy, choose the minimum score.
6. **Explain graceful degradation:** dynamic signals are optional; static routing and fallback protect availability.
7. **Discuss data/security:** tenant isolation, prompt retention, quota/cost protection, and authentication boundary.
8. **Scale it:** stateless APIs, Redis telemetry/rate limiting, Postgres for transactions, event-driven workers, OLAP for dashboards.
9. **Close with measurement:** define cost, latency, fallback, and quality SLIs; canary policy/model changes.

### Likely follow-up questions and concise answers

| Interview question | Strong answer |
| --- | --- |
| “Why not always use the strongest model?” | It wastes cost and can be slower. Routing lets simple tasks use inexpensive fast models while reserving higher capability for tasks that benefit from it. |
| “How do you know quality?” | Start with explicit priors and offline benchmarks; then collect structured-validation and judge/human feedback by task/model. Use it as a bounded signal, not an uncontrolled online learner. |
| “What happens if the router is wrong?” | The decision is logged with candidates and policy, so it is explainable. We monitor quality/cost/latency by cohort, tune policy offline, and can safely roll back configuration. |
| “What if a provider is down?” | Classify failures, circuit-break the unhealthy provider/model, retry a bounded fallback chain within the total deadline, and return a structured retryable error only when all viable paths fail. |
| “How do you prevent runaway cost?” | Tenant/user rate limits, token and output caps, budget checks before dispatch, per-provider concurrency control, and alerts on estimated versus actual spend. |
| “How do you support many tenants?” | Add tenant ID to identity, requests, logs, telemetry, quotas, and every query; enforce it at the data-access layer or with row-level security. |
| “Why use a queue?” | Evaluation, notifications, usage aggregation, and long-running/at-least-once work should not affect interactive inference latency or availability. |
| “How do you avoid duplicate model calls?” | Idempotency key plus durable request state; return the prior completed result for retried client requests. |

---

## 18. Source map for the implementation

| Area | Primary implementation file |
| --- | --- |
| API routes, orchestration, auth dependency, persistence | `backend/app/main.py` |
| API request/auth schemas | `backend/app/schemas.py` |
| Dynamic routing policy, telemetry, scoring | `backend/app/services/pareto_router.py` |
| Local ONNX semantic routing | `backend/app/services/embedding_router.py` |
| Static fallback router | `backend/app/router.py` |
| Provider execution and ordered fallbacks | `backend/app/llm_service.py` |
| Model catalog, priors, environment configuration | `backend/app/config.py` |
| SQL tables | `backend/app/models.py` |
| Analytics queries | `backend/app/analytics.py` |
| JWT and password primitives | `backend/app/auth_utils.py` |
| Async quality evaluator | `backend/app/tasks/evaluator.py` |
| Frontend session/client authorization | `frontend/components/AuthProvider.tsx` |
| Inference operator surface | `frontend/app/infer/page.tsx` |
| Dashboard operator surface | `frontend/components/DashboardPage.tsx` |
| Local run instructions | `docs/run_routealpha_locally.md` |
| Dynamic routing technical note | `docs/dynamic_routing.md` |

---

## 19. Closing statement

RouteAlpha's distinctive design choice is not merely choosing a cheap or strong model; it is treating model selection as an observable, policy-driven control plane. The MVP already has the essential loop—authenticate, classify, score, execute, fall back, record, analyze, and evaluate. The path to production is to make shared state durable and tenant-safe, move non-critical work out of the synchronous path, and govern every routing change with measurement, guardrails, and rollback.
