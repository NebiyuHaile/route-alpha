from pydantic import BaseModel, EmailStr, Field

class InferenceRequest(BaseModel):
    prompt: str
    task_type: str | None = "general"
    priority: str | None = "balanced"


class ContactRequestCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=120)
    team_size: str | None = Field(default=None, max_length=60)
    use_case: str = Field(min_length=10, max_length=1000)
    message: str | None = Field(default=None, max_length=2000)
