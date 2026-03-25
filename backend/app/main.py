from fastapi import FastAPI, HTTPException
from uuid import uuid4
from app.schemas import InferenceRequest
from app.router import choose_model
from app.llm_service import call_model

app = FastAPI(title="RouteAlpha API")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RouteAlpha backend"}


@app.post("/infer")
def infer(request: InferenceRequest):
    try:
        route_key, route_reason = choose_model(
            prompt=request.prompt,
            task_type=request.task_type or "general",
            priority=request.priority or "balanced"
        )

        result = call_model(route_key=route_key, prompt=request.prompt)

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
        raise HTTPException(status_code=500, detail=str(e))