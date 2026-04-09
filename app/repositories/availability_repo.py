"""Availability repository — DB queries for availability_slots."""

import uuid

from sqlalchemy.orm import Session

from app.models.availability import AvailabilitySlot


def get_slots_for_teacher(
    db: Session, user_name: str, active_only: bool = True, *, skip: int = 0, limit: int = 20
) -> tuple[list[AvailabilitySlot], int]:
    q = db.query(AvailabilitySlot).filter(AvailabilitySlot.user_name == user_name)
    if active_only:
        q = q.filter(AvailabilitySlot.is_active.is_(True))
    total = q.count()
    items = (
        q.order_by(AvailabilitySlot.day_of_week, AvailabilitySlot.start_time)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def get_slot_by_id(db: Session, slot_id: str) -> AvailabilitySlot | None:
    return db.query(AvailabilitySlot).filter(AvailabilitySlot.id == slot_id).first()


def get_active_slot_for_teacher_time(
    db: Session,
    user_name: str,
    day_of_week: str,
    start_time: str,
    end_time: str,
) -> AvailabilitySlot | None:
    return (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.user_name == user_name,
            AvailabilitySlot.day_of_week == day_of_week,
            AvailabilitySlot.start_time == start_time,
            AvailabilitySlot.end_time == end_time,
            AvailabilitySlot.is_active.is_(True),
        )
        .first()
    )


def create_slot(db: Session, user_name: str, day_of_week: str, start_time: str, end_time: str) -> AvailabilitySlot:
    slot = AvailabilitySlot(
        id=str(uuid.uuid4()),
        user_name=user_name,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        is_active=True,
    )
    db.add(slot)
    db.flush()
    return slot


def update_slot(db: Session, slot: AvailabilitySlot, data: dict) -> AvailabilitySlot:
    for key, value in data.items():
        if value is not None:
            setattr(slot, key, value)
    db.flush()
    return slot


def delete_slot(db: Session, slot: AvailabilitySlot) -> None:
    db.delete(slot)
    db.flush()
