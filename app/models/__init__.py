# models package — import all ORM models so Alembic can auto-detect them.

from app.models.user import Gender, User, UserProfile, UserRole
from app.models.teacher import TeacherProfile, TeacherSubjectMasterList, TeacherVideoDemo
from app.models.subject import Subject
from app.models.availability import AvailabilitySlot, DayOfWeek
from app.models.session import SessionSchedule, SessionStatus
from app.models.rating import Rating
from app.models.wallet import TeacherWallet, Withdrawal, WithdrawalStatus
from app.models.notification import Notification, NotificationType

__all__ = [
    # user
    "User",
    "UserProfile",
    "UserRole",
    "Gender",
    # teacher
    "TeacherProfile",
    "TeacherSubjectMasterList",
    "TeacherVideoDemo",
    # subject
    "Subject",
    # availability
    "AvailabilitySlot",
    "DayOfWeek",
    # session
    "SessionSchedule",
    "SessionStatus",
    # rating
    "Rating",
    # wallet
    "TeacherWallet",
    "Withdrawal",
    "WithdrawalStatus",
    # notification
    "Notification",
    "NotificationType",
]
