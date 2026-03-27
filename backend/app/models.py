from sqlalchemy import Column, String, Text, Float, Integer, DateTime
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
    model_used = Column(String, nullable=False)
    estimated_input_tokens = Column(Integer, nullable=False)
    estimated_output_tokens = Column(Integer, nullable=False)
    estimated_cost_usd = Column(Float, nullable=False)
    latency_ms = Column(Float, nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))