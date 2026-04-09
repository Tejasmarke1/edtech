"""add_withdrawal_payout_fields

Revision ID: d7a1c4e9f230
Revises: c9e2a4d7b1f3
Create Date: 2026-03-18 12:00:00.000000

"""
from typing import Sequence, Union
import hashlib

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7a1c4e9f230"
down_revision: Union[str, Sequence[str], None] = "c9e2a4d7b1f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'processing'")

    op.add_column("withdrawal", sa.Column("gateway", sa.String(length=64), nullable=True))
    op.add_column("withdrawal", sa.Column("idempotency_key", sa.String(length=255), nullable=True))
    op.add_column("withdrawal", sa.Column("gateway_contact_id", sa.String(length=255), nullable=True))
    op.add_column("withdrawal", sa.Column("gateway_fund_account_id", sa.String(length=255), nullable=True))
    op.add_column("withdrawal", sa.Column("gateway_payout_id", sa.String(length=255), nullable=True))
    op.add_column("withdrawal", sa.Column("gateway_metadata", sa.JSON(), nullable=True))
    op.add_column("withdrawal", sa.Column("last_error", sa.String(length=1000), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, teacher_id, amount, request_at "
            "FROM withdrawal WHERE idempotency_key IS NULL"
        )
    ).fetchall()
    for row in rows:
        raw = f"withdrawal:{row.teacher_id}:{row.amount}:{row.request_at.isoformat()}:{row.id}"
        idem = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        bind.execute(
            sa.text("UPDATE withdrawal SET idempotency_key=:idem WHERE id=:id"),
            {"idem": idem, "id": row.id},
        )

    op.alter_column("withdrawal", "idempotency_key", existing_type=sa.String(length=255), nullable=False)
    op.create_unique_constraint("uq_withdrawal_idempotency_key", "withdrawal", ["idempotency_key"])
    op.create_unique_constraint("uq_withdrawal_gateway_payout_id", "withdrawal", ["gateway_payout_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_withdrawal_gateway_payout_id", "withdrawal", type_="unique")
    op.drop_constraint("uq_withdrawal_idempotency_key", "withdrawal", type_="unique")

    op.drop_column("withdrawal", "last_error")
    op.drop_column("withdrawal", "gateway_metadata")
    op.drop_column("withdrawal", "gateway_payout_id")
    op.drop_column("withdrawal", "gateway_fund_account_id")
    op.drop_column("withdrawal", "gateway_contact_id")
    op.drop_column("withdrawal", "idempotency_key")
    op.drop_column("withdrawal", "gateway")

    # PostgreSQL enum labels are append-only in standard migrations; keep 'processing'.
