"""add_lowercase_open_to_session_status_enum

Revision ID: 595a173363f0
Revises: 5b141d05f1b8
Create Date: 2026-03-17 19:21:48.026728

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '595a173363f0'
down_revision: Union[str, Sequence[str], None] = '5b141d05f1b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'open'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL does not support removing enum values safely in-place.
    # This downgrade is intentionally a no-op.
    pass
