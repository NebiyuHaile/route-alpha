import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from uuid import uuid4
from app.schemas import ContactRequestCreate, InferenceRequest
from app.router import choose_model
from app.llm_service import call_model
from app.database import Base, engine, SessionLocal
from app.models import ContactRequest, InferenceLog
from app.email_utils import send_contact_notification
from app.analytics import (get_summary_stats, get_route_breakdown, get_model_breakdown, get_cost_breakdown, get_latency_breakdown, get_recent_requests)

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
    }

    with engine.begin() as connection:
        for column_name, statement in column_definitions.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(statement))


ensure_inference_log_columns()

app = FastAPI(title="RouteAlpha API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RouteAlpha backend"}

@app.get("/analytics/summary")
def analytics_summary():
    return get_summary_stats()


@app.get("/analytics/routes")
def analytics_routes():
    return get_route_breakdown()


@app.get("/analytics/models")
def analytics_models():
    return get_model_breakdown()

@app.get("/analytics/costs")
def analytics_costs():
    return get_cost_breakdown()

@app.get("/analytics/latency")
def analytics_latency():
    return get_latency_breakdown()

@app.get("/analytics/recent")
def analytics_recent(limit: int = 10):
    return get_recent_requests(limit=limit)


@app.post("/infer")
def infer(request: InferenceRequest):
    db = SessionLocal()
    try:
        route_key, route_reason = choose_model(
            prompt=request.prompt,
            task_type=request.task_type or "general",
            priority=request.priority or "balanced"
        )

        result = call_model(route_key=route_key, prompt=request.prompt)

        request_id = str(uuid4())

        log = InferenceLog(
            request_id=request_id,
            prompt=request.prompt,
            task_type=request.task_type,
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
        )

        db.add(log)
        db.commit()

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
            "task_type": request.task_type,
            "priority": request.priority,
            "estimated_input_tokens": result["estimated_input_tokens"],
            "estimated_output_tokens": result["estimated_output_tokens"],
            "estimated_cost_usd": result["estimated_cost_usd"],
            "response": result["response_text"],
            "latency_ms": result["latency_ms"],
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/contact")
def create_contact_request(request: ContactRequestCreate):
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

        email_sent, email_status = send_contact_notification(
            request_id=request_id, request=request
        )

        return {
            "request_id": request_id,
            "message": "Contact request submitted successfully.",
            "email_sent": email_sent,
            "email_status": email_status,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
