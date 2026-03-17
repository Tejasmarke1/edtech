"""Payment calculation helpers for platform and commission charges."""

from app.config import settings


def calculate_commission(gross_amount: int, commission_percent: float) -> int:
    """Return commission amount rounded to nearest rupee."""
    if gross_amount <= 0 or commission_percent <= 0:
        return 0
    return int(round(gross_amount * commission_percent / 100.0))


def calculate_teacher_payout(gross_amount: int, commission_percent: float) -> int:
    """Return net payout credited to teacher wallet."""
    commission = calculate_commission(gross_amount, commission_percent)
    return max(gross_amount - commission, 0)


def calculate_payment_breakdown(
    gross_amount: int,
    *,
    payer_count: int,
    platform_charge_per_payer: int,
    commission_percent: float,
) -> dict:
    """Return full payment breakdown for UI/API responses."""
    platform_charge_total = max(platform_charge_per_payer, 0) * max(payer_count, 0)
    commission_charge = calculate_commission(gross_amount, commission_percent)
    teacher_payout = max(gross_amount - commission_charge, 0)
    total_payable = gross_amount + platform_charge_total
    return {
        "gross_amount": gross_amount,
        "platform_charge": platform_charge_total,
        "commission_charge": commission_charge,
        "teacher_payout": teacher_payout,
        "total_payable": total_payable,
    }


def get_platform_charge_per_user(session_type: str) -> int:
    """Return per-user platform charge for the given session type."""
    if session_type == "group":
        return settings.PLATFORM_CHARGE_PER_USER_GROUP
    if session_type == "individual":
        return settings.PLATFORM_CHARGE_PER_USER_INDIVIDUAL
    return settings.PLATFORM_CHARGE_PER_USER


def get_commission_percent(session_type: str) -> float:
    """Return teacher commission percentage for the given session type."""
    if session_type == "group":
        return settings.COMMISSION_PERCENT_GROUP
    if session_type == "individual":
        return settings.COMMISSION_PERCENT_INDIVIDUAL
    return settings.COMMISSION_PERCENT
