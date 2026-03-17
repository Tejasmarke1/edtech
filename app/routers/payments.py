"""Payment router — order creation, webhook processing, earnings, withdrawals."""

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.wallet import (
    CreatePaymentOrderRequest,
    MonthlyEarningsRead,
    PaymentOrderRead,
    PaymentTransactionRead,
    PaymentWebhookAck,
    ProcessWithdrawalRequest,
    WithdrawalProcessResult,
)
from app.services import payment_service

router = APIRouter()


@router.post("/orders", response_model=PaymentOrderRead)
def create_payment_order(
    payload: CreatePaymentOrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create or fetch an idempotent payment order for a session."""
    return payment_service.create_payment_order(db, user, payload.session_id)


@router.get("/transactions/{transaction_id}", response_model=PaymentTransactionRead)
def get_payment_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return payment_service.get_payment_transaction(db, user, transaction_id)


@router.post("/webhook/{provider}", response_model=PaymentWebhookAck)
async def payment_webhook(
    provider: str,
    request: Request,
    x_payment_signature: str | None = Header(None, alias="X-Payment-Signature"),
    x_razorpay_signature: str | None = Header(None, alias="X-Razorpay-Signature"),
    db: Session = Depends(get_db),
):
    signature = x_payment_signature or x_razorpay_signature
    if not signature:
        from app.utils.exceptions import BadRequestError

        raise BadRequestError("Missing webhook signature header")

    raw_body = await request.body()
    payload = await request.json()
    return payment_service.process_webhook(
        db,
        provider=provider,
        payload=payload,
        raw_body=raw_body,
        signature=signature,
    )


@router.get("/earnings/monthly", response_model=MonthlyEarningsRead)
def get_monthly_earnings(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get earnings breakdown for a specific month."""
    return payment_service.get_monthly_earnings(db, user, year, month)


@router.post("/withdrawals/process", response_model=WithdrawalProcessResult)
def process_withdrawal(
    payload: ProcessWithdrawalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin/mock — mark a withdrawal as success or failed."""
    return payment_service.process_withdrawal_status(
        db, payload.withdrawal_id, payload.success
    )
