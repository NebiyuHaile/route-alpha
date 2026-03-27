from sqlalchemy import func
from app.database import SessionLocal
from app.models import InferenceLog


def get_summary_stats():
    db = SessionLocal()
    try:
        total_requests = db.query(func.count(InferenceLog.request_id)).scalar() or 0
        avg_latency = db.query(func.avg(InferenceLog.latency_ms)).scalar() or 0
        total_cost = db.query(func.sum(InferenceLog.estimated_cost_usd)).scalar() or 0

        return {
            "total_requests": total_requests,
            "average_latency_ms": round(float(avg_latency), 2),
            "total_estimated_cost_usd": round(float(total_cost), 6),
        }
    finally:
        db.close()


def get_route_breakdown():
    db = SessionLocal()
    try:
        rows = (
            db.query(
                InferenceLog.route_key,
                func.count(InferenceLog.request_id).label("count")
            )
            .group_by(InferenceLog.route_key)
            .all()
        )

        return [
            {"route_key": row.route_key, "count": row.count}
            for row in rows
        ]
    finally:
        db.close()


def get_model_breakdown():
    db = SessionLocal()
    try:
        rows = (
            db.query(
                InferenceLog.model_used,
                func.count(InferenceLog.request_id).label("count")
            )
            .group_by(InferenceLog.model_used)
            .all()
        )

        return [
            {"model_used": row.model_used, "count": row.count}
            for row in rows
        ]
    finally:
        db.close()

def get_cost_breakdown():
    db = SessionLocal()
    try:
        rows = (
            db.query(
                InferenceLog.model_used,
                func.sum(InferenceLog.estimated_cost_usd).label("total_cost")
            )
            .group_by(InferenceLog.model_used)
            .all()
        )

        return [
            {
                "model_used": row.model_used,
                "total_estimated_cost_usd": round(float(row.total_cost or 0), 6)
            }
            for row in rows
        ]
    finally:
        db.close()


def get_latency_breakdown():
    db = SessionLocal()
    try:
        rows = (
            db.query(
                InferenceLog.model_used,
                func.avg(InferenceLog.latency_ms).label("average_latency")
            )
            .group_by(InferenceLog.model_used)
            .all()
        )

        return [
            {
                "model_used": row.model_used,
                "average_latency_ms": round(float(row.average_latency or 0), 2)
            }
            for row in rows
        ]
    finally:
        db.close()