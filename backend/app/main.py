from fastapi import FastAPI, HTTPException
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

        model_used, response_text, latency_ms = call_model(
            route_key=route_key,
            prompt=request.prompt
        )

        return {
            "route_key": route_key,
            "route_reason": route_reason,
            "model_used": model_used,
            "task_type": request.task_type,
            "priority": request.priority,
            "response": response_text,
            "latency_ms": latency_ms
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))