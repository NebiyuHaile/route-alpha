from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
from app.schemas import InferenceRequest
from app.router import choose_model
from app.llm_service import call_model
from app.database import Base, engine, SessionLocal
from app.models import InferenceLog
from app.analytics import (get_summary_stats, get_route_breakdown, get_model_breakdown, get_cost_breakdown, get_latency_breakdown)

Base.metadata.create_all(bind=engine)
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
            "request_id": str(uuid4()),
            "route_key": route_key,
            "route_reason": route_reason,
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