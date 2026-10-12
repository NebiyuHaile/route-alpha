"""Create the RouteAlpha application schema.

Revision ID: 20260905_0001
Revises:
Create Date: 2026-09-05
"""

from alembic import op
import sqlalchemy as sa


revision = "20260905_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inference_logs",
        sa.Column("request_id", sa.String(), primary_key=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("task_type", sa.String()),
        sa.Column("priority", sa.String()),
        sa.Column("route_key", sa.String(), nullable=False),
        sa.Column("route_reason", sa.Text(), nullable=False),
        sa.Column("resolved_route_key", sa.String()),
        sa.Column("fallback_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("fallback_reason", sa.Text()),
        sa.Column("attempted_routes", sa.Text()),
        sa.Column("attempted_models", sa.Text()),
        sa.Column("model_used", sa.String(), nullable=False),
        sa.Column("estimated_input_tokens", sa.Integer(), nullable=False),
        sa.Column("estimated_output_tokens", sa.Integer(), nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("expected_json_schema", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_inference_logs_request_id", "inference_logs", ["request_id"])

    op.create_table(
        "contact_requests",
        sa.Column("request_id", sa.String(), primary_key=True),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("company", sa.String()),
        sa.Column("team_size", sa.String()),
        sa.Column("use_case", sa.String(), nullable=False),
        sa.Column("message", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_contact_requests_request_id", "contact_requests", ["request_id"])
    op.create_index("ix_contact_requests_email", "contact_requests", ["email"])

    op.create_table(
        "users",
        sa.Column("user_id", sa.String(), primary_key=True),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("company", sa.String()),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("totp_secret", sa.String()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_users_user_id", "users", ["user_id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "model_task_performance",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("model_used", sa.String(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=False),
        sa.Column("accuracy_rating", sa.Float(), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_index("ix_model_task_performance_model_used", "model_task_performance", ["model_used"])
    op.create_index("ix_model_task_performance_task_type", "model_task_performance", ["task_type"])


def downgrade() -> None:
    op.drop_index("ix_model_task_performance_task_type", table_name="model_task_performance")
    op.drop_index("ix_model_task_performance_model_used", table_name="model_task_performance")
    op.drop_table("model_task_performance")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_user_id", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_contact_requests_email", table_name="contact_requests")
    op.drop_index("ix_contact_requests_request_id", table_name="contact_requests")
    op.drop_table("contact_requests")
    op.drop_index("ix_inference_logs_request_id", table_name="inference_logs")
    op.drop_table("inference_logs")
