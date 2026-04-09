"""seed_cs_subject_master_list

Revision ID: c9e2a4d7b1f3
Revises: f5baeaa2ba39
Create Date: 2026-04-05 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9e2a4d7b1f3"
down_revision: Union[str, Sequence[str], None] = "8c3f2b9d1e77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CS_SUBJECTS: list[tuple[str, str]] = [
    ("cs101", "Introduction to Computer Science"),
    ("cs102", "Data Structures and Algorithms"),
    ("cs103", "Object-Oriented Programming"),
    ("cs104", "Database Management Systems"),
    ("cs105", "Operating Systems"),
    ("cs106", "Computer Networks"),
    ("cs107", "Software Engineering"),
    ("cs108", "Web Development"),
    ("cs109", "Machine Learning"),
    ("cs110", "Artificial Intelligence"),
    ("cs111", "Cloud Computing"),
    ("cs112", "Cybersecurity"),
    ("cs113", "Compiler Design"),
    ("cs114", "Distributed Systems"),
    ("cs115", "Theory of Computation"),
]


def upgrade() -> None:
    """Insert CS engineering subjects into subject master list."""
    for sub_id, name in CS_SUBJECTS:
        op.execute(
            sa.text(
                """
                INSERT INTO subject (sub_id, name)
                VALUES (:sub_id, :name)
                ON CONFLICT (sub_id)
                DO UPDATE SET name = EXCLUDED.name
                """
            ).bindparams(sub_id=sub_id, name=name)
        )


def downgrade() -> None:
    """Remove seeded CS engineering subjects."""
    sub_ids = [sub_id for sub_id, _ in CS_SUBJECTS]
    op.execute(
        sa.text("DELETE FROM subject WHERE sub_id IN :sub_ids").bindparams(
            sa.bindparam("sub_ids", value=sub_ids, expanding=True)
        )
    )
