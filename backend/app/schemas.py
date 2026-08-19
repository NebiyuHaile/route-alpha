from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.services.pareto_router import RoutingPolicy

class InferenceRequest(BaseModel):
    """Validated request sent to the inference gateway."""

    prompt: str = Field(min_length=1, max_length=100_000)
    task_type: str | None = "general"
    priority: str | None = "balanced"
    routing_policy: RoutingPolicy | None = None
    expected_json_schema: dict[str, Any] | None = None


class ContactRequestCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=120)
    team_size: str | None = Field(default=None, max_length=60)
    use_case: str = Field(min_length=10, max_length=1000)
    message: str | None = Field(default=None, max_length=2000)


class UserRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=120)
    password: str = Field(max_length=128)

    @field_validator("password")
    @classmethod
    def password_meets_minimum_security_requirements(cls, password: str) -> str:
        missing_requirements: list[str] = []
        if len(password) < 8:
            missing_requirements.append("at least 8 characters")
        if not any(character.isalpha() for character in password):
            missing_requirements.append("at least one letter")
        if not any(character.isdigit() for character in password):
            missing_requirements.append("at least one number")
        if missing_requirements:
            raise ValueError(
                "Password must include " + ", ".join(missing_requirements) + "."
            )
        return password


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    otp_code: str | None = Field(default=None, min_length=6, max_length=8)


class UserResponse(BaseModel):
    user_id: str
    full_name: str
    email: EmailStr
    company: str | None = None
    two_factor_enabled: bool = False


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TwoFactorSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str


class TwoFactorEnableRequest(BaseModel):
    otp_code: str = Field(min_length=6, max_length=8)
