from pydantic import BaseModel

class InferenceRequest(BaseModel):
    prompt: str
    task_type: str | None = "general"
    priority: str | None = "balanced"