import json
import asyncio
import logging
import math
import time
from contextlib import asynccontextmanager

import pyotp
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import inspect, text
from uuid import uuid4
from app.auth_utils import create_access_token, decode_access_token, hash_password, verify_password
from app.schemas import (
    AuthResponse,
    ContactRequestCreate,
    InferenceRequest,
    TwoFactorEnableRequest,
    TwoFactorSetupResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.router import choose_model
from app.llm_service import call_model
from app.database import Base, engine, SessionLocal
from app.models import ContactRequest, InferenceLog, ModelTaskPerformance, User
from app.email_utils import send_contact_notification_safely
from app.analytics import (get_summary_stats, get_route_breakdown, get_model_breakdown, get_cost_breakdown, get_latency_breakdown, get_recent_requests)
from app.config import EMBEDDING_MAX_LENGTH, EMBEDDING_MODEL_DIR, MODEL_ACCURACY_RATINGS, MODEL_CATALOG
from app.services.embedding_router import EmbeddingRouter
from app.services.pareto_router import ParetoRouter, RoutingPolicy, TelemetryTracker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

LOGIN_FAILURE_LIMIT = parse("5/15 minutes")
LOGIN_FAILURE_SCOPE = "auth-login-failures"
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")

embedding_router = EmbeddingRouter(EMBEDDING_MODEL_DIR, EMBEDDING_MAX_LENGTH)
telemetry_tracker = TelemetryTracker()
pareto_router = ParetoRouter(telemetry_tracker)

Base.metadata.create_all(bind=engine)


def ensure_inference_log_columns() -> None:
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("inference_logs")}
    column_definitions = {
        "resolved_route_key": "ALTER TABLE inference_logs ADD COLUMN resolved_route_key VARCHAR",
        "fallback_used": "ALTER TABLE inference_logs ADD COLUMN fallback_used BOOLEAN DEFAULT FALSE",
        "fallback_reason": "ALTER TABLE inference_logs ADD COLUMN fallback_reason TEXT",
        "attempted_routes": "ALTER TABLE inference_logs ADD COLUMN attempted_routes TEXT",
        "attempted_models": "ALTER TABLE inference_logs ADD COLUMN attempted_models TEXT",
        "expected_json_schema": "ALTER TABLE inference_logs ADD COLUMN expected_json_schema TEXT",
    }

    with engine.begin() as connection:
        for column_name, statement in column_definitions.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(statement))


ensure_inference_log_columns()


def ensure_user_columns() -> None:
    """Add auth-security columns for existing local databases without a migration tool."""
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    column_definitions = {
        "is_admin": "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE",
        "two_factor_enabled": "ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE",
        "totp_secret": "ALTER TABLE users ADD COLUMN totp_secret VARCHAR",
    }

    with engine.begin() as connection:
        for column_name, statement in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))


ensure_user_columns()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize optional local routing resources without blocking API startup."""
    await embedding_router.initialize()
    yield


app = FastAPI(title="RouteAlpha API", lifespan=lifespan)
app.state.limiter = limiter
auth_scheme = HTTPBearer(auto_error=False)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        company=user.company,
        two_factor_enabled=user.two_factor_enabled,
    )


def _login_failure_key(request: Request, email: str) -> str:
    """Scope failed-login attempts to the source IP and normalized account."""
    return f"{get_remote_address(request)}:{email.strip().lower()}"


def enforce_failed_login_limit(request: Request, email: str) -> None:
    """Record a failed attempt with SlowAPI's limiter and reject excess attempts."""
    key = _login_failure_key(request, email)
    if limiter.limiter.hit(LOGIN_FAILURE_LIMIT, key, LOGIN_FAILURE_SCOPE):
        return

    window = limiter.limiter.get_window_stats(
        LOGIN_FAILURE_LIMIT, key, LOGIN_FAILURE_SCOPE
    )
    retry_after = max(1, math.ceil(window.reset_time - time.time()))
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many failed login attempts. Try again after the retry period.",
        headers={"Retry-After": str(retry_after)},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == payload["sub"]).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive.",
            )
        return user
    finally:
        db.close()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require a server-side administrator role for future privileged routes."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )
    return current_user


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RouteAlpha backend"}


@app.post("/auth/register", response_model=AuthResponse)
def register(request: UserRegisterRequest):
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == request.email.lower()).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with that email already exists.",
            )

        user = User(
            user_id=str(uuid4()),
            full_name=request.full_name.strip(),
            email=request.email.lower().strip(),
            company=request.company.strip() if request.company else None,
            password_hash=hash_password(request.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return AuthResponse(
            access_token=create_access_token(user.user_id, user.email),
            user=serialize_user(user),
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/auth/login", response_model=AuthResponse)
def login(request: UserLoginRequest, http_request: Request):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == request.email.lower()).first()
        if not user or not verify_password(request.password, user.password_hash):
            enforce_failed_login_limit(http_request, request.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is inactive.",
            )
        if user.two_factor_enabled:
            if not request.otp_code or not user.totp_secret or not pyotp.TOTP(
                user.totp_secret
            ).verify(request.otp_code, valid_window=1):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="A valid two-factor authentication code is required.",
                )

        return AuthResponse(
            access_token=create_access_token(user.user_id, user.email),
            user=serialize_user(user),
        )
    finally:
        db.close()


@app.get("/auth/me", response_model=UserResponse)
def auth_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@app.post("/auth/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_two_factor(current_user: User = Depends(get_current_user)):
    """Create a new authenticator-app secret; a separate code verification enables it."""
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is already enabled.",
        )

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == current_user.user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
        user.totp_secret = secret
        user.two_factor_enabled = False
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return TwoFactorSetupResponse(
        secret=secret,
        provisioning_uri=pyotp.TOTP(secret).provisioning_uri(
            name=current_user.email, issuer_name="RouteAlpha"
        ),
    )


@app.post("/auth/2fa/enable", response_model=UserResponse)
def enable_two_factor(
    request: TwoFactorEnableRequest,
    current_user: User = Depends(get_current_user),
):
    """Verify the setup code before enabling mandatory TOTP at login."""
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set up two-factor authentication before enabling it.",
        )
    if not pyotp.TOTP(current_user.totp_secret).verify(request.otp_code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid two-factor authentication code.",
        )

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == current_user.user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
        user.two_factor_enabled = True
        db.commit()
        db.refresh(user)
        return serialize_user(user)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@app.get("/analytics/summary")
def analytics_summary(current_user: User = Depends(get_current_user)):
    return get_summary_stats()


@app.get("/analytics/routes")
def analytics_routes(current_user: User = Depends(get_current_user)):
    return get_route_breakdown()


@app.get("/analytics/models")
def analytics_models(current_user: User = Depends(get_current_user)):
    return get_model_breakdown()

@app.get("/analytics/costs")
def analytics_costs(current_user: User = Depends(get_current_user)):
    return get_cost_breakdown()

@app.get("/analytics/latency")
def analytics_latency(current_user: User = Depends(get_current_user)):
    return get_latency_breakdown()

@app.get("/analytics/recent")
def analytics_recent(limit: int = 10, current_user: User = Depends(get_current_user)):
    return get_recent_requests(limit=limit)


def _load_accuracy_ratings(task_type: str) -> dict[str, float]:
    """Read evaluator-adjusted accuracy ratings for a semantic task category."""
    db = SessionLocal()
    try:
        ratings = dict(MODEL_ACCURACY_RATINGS)
        rows = db.query(ModelTaskPerformance).filter(ModelTaskPerformance.task_type == task_type).all()
        for row in rows:
            route_key = next((key for key, model in MODEL_CATALOG.items() if model == row.model_used), None)
            if route_key:
                ratings[route_key] = row.accuracy_rating
        return ratings
    finally:
        db.close()


def _policy_from_priority(priority: str, supplied: RoutingPolicy | None) -> RoutingPolicy:
    """Use explicit policy when supplied, otherwise retain legacy priority semantics."""
    if supplied:
        return supplied
    return {
        "cheap": RoutingPolicy(cost_weight=0.8, latency_weight=0.15, accuracy_weight=0.05),
        "fast": RoutingPolicy(cost_weight=0.15, latency_weight=0.8, accuracy_weight=0.05),
        "quality": RoutingPolicy(cost_weight=0.05, latency_weight=0.1, accuracy_weight=0.85),
    }.get(priority, RoutingPolicy())


@app.post("/infer")
async def infer(request: InferenceRequest, current_user: User = Depends(get_current_user)):
    """Semantically classify, dynamically route, execute, and record an inference."""
    db = SessionLocal()
    try:
        semantic_match = await embedding_router.classify(request.prompt)
        task_type = request.task_type or "general"
        if task_type == "general" and semantic_match:
            task_type = semantic_match.category
        policy = _policy_from_priority(request.priority or "balanced", request.routing_policy)
        try:
            accuracy_ratings = await asyncio.to_thread(_load_accuracy_ratings, task_type)
            decision = await pareto_router.choose(policy, accuracy_ratings)
            route_key = decision.route_key
            route_reason = f"Pareto dynamic routing selected {route_key} for {task_type}"
            logger.info(
                "routing_decision %s",
                json.dumps(
                    {
                        "semantic_category": semantic_match.category if semantic_match else None,
                        "semantic_similarity": semantic_match.similarity if semantic_match else None,
                        "task_type": task_type,
                        "candidate_scores": decision.candidate_scores,
                        "winning_route": route_key,
                    },
                    sort_keys=True,
                ),
            )
        except Exception:
            logger.exception("pareto_routing_failed", extra={"fallback": "static_route"})
            route_key, route_reason = choose_model(request.prompt, task_type, request.priority or "balanced")
            decision = None
        result = await asyncio.to_thread(call_model, route_key, request.prompt)
        token_total = result["estimated_input_tokens"] + result["estimated_output_tokens"]
        cost_per_1k = result["estimated_cost_usd"] / max(token_total / 1000, 1)
        await telemetry_tracker.record(result["resolved_route_key"], cost_per_1k, result["latency_ms"] / 1000)

        request_id = str(uuid4())

        log = InferenceLog(
            request_id=request_id,
            prompt=request.prompt,
            task_type=task_type,
            priority=request.priority,
            route_key=route_key,
            route_reason=route_reason,
            resolved_route_key=result["resolved_route_key"],
            fallback_used=result["fallback_used"],
            fallback_reason=result["fallback_reason"],
            attempted_routes=json.dumps(result["attempted_routes"]),
            attempted_models=json.dumps(result["attempted_models"]),
            model_used=result["model_used"],
            estimated_input_tokens=result["estimated_input_tokens"],
            estimated_output_tokens=result["estimated_output_tokens"],
            estimated_cost_usd=result["estimated_cost_usd"],
            latency_ms=result["latency_ms"],
            response=result["response_text"],
            expected_json_schema=json.dumps(request.expected_json_schema) if request.expected_json_schema else None,
        )

        db.add(log)
        await asyncio.to_thread(db.commit)

        return {
            "request_id": request_id,
            "route_key": route_key,
            "route_reason": route_reason,
            "resolved_route_key": result["resolved_route_key"],
            "fallback_used": result["fallback_used"],
            "fallback_reason": result["fallback_reason"],
            "attempted_routes": result["attempted_routes"],
            "attempted_models": result["attempted_models"],
            "model_used": result["model_used"],
            "task_type": task_type,
            "priority": request.priority,
            "estimated_input_tokens": result["estimated_input_tokens"],
            "estimated_output_tokens": result["estimated_output_tokens"],
            "estimated_cost_usd": result["estimated_cost_usd"],
            "response": result["response_text"],
            "latency_ms": result["latency_ms"],
            "semantic_category": semantic_match.category if semantic_match else None,
            "semantic_similarity": semantic_match.similarity if semantic_match else None,
            "pareto_score": decision.score if decision else None,
            "candidate_scores": decision.candidate_scores if decision else None,
        }

    except Exception as e:
        await asyncio.to_thread(db.rollback)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await asyncio.to_thread(db.close)


@app.post("/contact")
def create_contact_request(
    request: ContactRequestCreate, background_tasks: BackgroundTasks
):
    db = SessionLocal()
    try:
        request_id = str(uuid4())

        contact_request = ContactRequest(
            request_id=request_id,
            full_name=request.full_name.strip(),
            email=request.email.lower().strip(),
            company=request.company.strip() if request.company else None,
            team_size=request.team_size.strip() if request.team_size else None,
            use_case=request.use_case.strip(),
            message=request.message.strip() if request.message else None,
        )

        db.add(contact_request)
        db.commit()

        background_tasks.add_task(
            send_contact_notification_safely, request_id=request_id, request=request
        )

        return {
            "request_id": request_id,
            "message": "Contact request submitted successfully.",
            "email_sent": False,
            "email_status": "Notification delivery is processing in the background.",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
