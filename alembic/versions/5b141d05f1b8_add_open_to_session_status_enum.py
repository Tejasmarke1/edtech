"""add_open_to_session_status_enum

Revision ID: 5b141d05f1b8
Revises: f5baeaa2ba39
Create Date: 2026-03-17 19:18:18.259423

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b141d05f1b8'
down_revision: Union[str, Sequence[str], None] = 'f5baeaa2ba39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'Open'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL does not support removing enum values safely in-place.
    # This downgrade is intentionally a no-op.
    pass
