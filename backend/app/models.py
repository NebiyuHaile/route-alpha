from sqlalchemy import Boolean, Column, String, Text, Float, Integer, DateTime
from datetime import datetime, UTC
from app.database import Base

class InferenceLog(Base):
    __tablename__ = "inference_logs"

    request_id = Column(String, primary_key=True, index=True)
    prompt = Column(Text, nullable=False)
    task_type = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    route_key = Column(String, nullable=False)
    route_reason = Column(Text, nullable=False)
    resolved_route_key = Column(String, nullable=True)
    fallback_used = Column(Boolean, nullable=False, default=False)
    fallback_reason = Column(Text, nullable=True)
    attempted_routes = Column(Text, nullable=True)
    attempted_models = Column(Text, nullable=True)
    model_used = Column(String, nullable=False)
    estimated_input_tokens = Column(Integer, nullable=False)
    estimated_output_tokens = Column(Integer, nullable=False)
    estimated_cost_usd = Column(Float, nullable=False)
    latency_ms = Column(Float, nullable=False)
    response = Column(Text, nullable=False)
    expected_json_schema = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class ContactRequest(Base):
    __tablename__ = "contact_requests"

    request_id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    company = Column(String, nullable=True)
    team_size = Column(String, nullable=True)
    use_case = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    company = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class ModelTaskPerformance(Base):
    """Persisted evaluator feedback used to adjust model accuracy by task type."""

    __tablename__ = "model_task_performance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_used = Column(String, nullable=False, index=True)
    task_type = Column(String, nullable=False, index=True)
    accuracy_rating = Column(Float, nullable=False)
    sample_count = Column(Integer, nullable=False, default=0)
    failure_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
