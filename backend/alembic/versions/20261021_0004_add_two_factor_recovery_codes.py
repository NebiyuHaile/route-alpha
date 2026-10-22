"""Add hashed one-time recovery codes for TOTP accounts.

Revision ID: 20261021_0004
Revises: 20261021_0003
Create Date: 2026-10-21
"""

from alembic import op
import sqlalchemy as sa


revision = "20261021_0004"
down_revision = "20261021_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("two_factor_recovery_code_hashes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "two_factor_recovery_code_hashes")
