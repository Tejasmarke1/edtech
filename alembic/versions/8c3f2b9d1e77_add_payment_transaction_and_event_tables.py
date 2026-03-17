"""add_payment_transaction_and_event_tables

Revision ID: 8c3f2b9d1e77
Revises: 595a173363f0
Create Date: 2026-03-17 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "8c3f2b9d1e77"
down_revision: Union[str, Sequence[str], None] = "595a173363f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    payment_gateway_enum = sa.Enum("mock", "razorpay", "stripe", name="payment_gateway")
    payment_status_enum = sa.Enum(
        "created", "authorized", "captured", "failed", "refunded", name="payment_status"
    )
    payment_event_status_enum = sa.Enum(
        "received", "processed", "ignored", "failed", name="payment_event_status"
    )

    payment_gateway_enum.create(op.get_bind(), checkfirst=True)
    payment_status_enum.create(op.get_bind(), checkfirst=True)
    payment_event_status_enum.create(op.get_bind(), checkfirst=True)

    payment_gateway_col = postgresql.ENUM(
        "mock", "razorpay", "stripe", name="payment_gateway", create_type=False
    )
    payment_status_col = postgresql.ENUM(
        "created", "authorized", "captured", "failed", "refunded",
        name="payment_status",
        create_type=False,
    )
    payment_event_status_col = postgresql.ENUM(
        "received", "processed", "ignored", "failed",
        name="payment_event_status",
        create_type=False,
    )

    op.create_table(
        "payment_transaction",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("session_id", sa.String(length=255), nullable=False),
        sa.Column("payer_id", sa.String(length=255), nullable=False),
        sa.Column("payee_id", sa.String(length=255), nullable=False),
        sa.Column("gross_amount", sa.Integer(), nullable=False),
        sa.Column("platform_charge", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("commission_charge", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("net_payout", sa.Integer(), nullable=False),
        sa.Column("total_payable", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("gateway", payment_gateway_col, nullable=False, server_default="mock"),
        sa.Column("status", payment_status_col, nullable=False, server_default="created"),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("gateway_order_id", sa.String(length=255), nullable=True),
        sa.Column("gateway_payment_id", sa.String(length=255), nullable=True),
        sa.Column("gateway_signature", sa.String(length=500), nullable=True),
        sa.Column("gateway_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["session_schedule.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payer_id"], ["user.user_name"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payee_id"], ["user.user_name"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
        sa.UniqueConstraint("gateway", "gateway_order_id", name="uq_payment_gateway_order"),
        sa.UniqueConstraint("gateway", "gateway_payment_id", name="uq_payment_gateway_payment"),
    )

    op.create_table(
        "payment_event",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("gateway", payment_gateway_col, nullable=False),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=255), nullable=False),
        sa.Column("status", payment_event_status_col, nullable=False, server_default="received"),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("transaction_id", sa.String(length=255), nullable=True),
        sa.Column("processing_error", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["transaction_id"], ["payment_transaction.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gateway", "event_id", name="uq_payment_gateway_event_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("payment_event")
    op.drop_table("payment_transaction")

    sa.Enum(name="payment_event_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="payment_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="payment_gateway").drop(op.get_bind(), checkfirst=True)
