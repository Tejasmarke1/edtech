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
    PaymentVerificationAck,
    VerifyPaymentRequest,
    WithdrawalReconcileResult,
    WithdrawalProcessResult,
)
from app.services import payment_service
from app.utils.pagination import Page, PaginationParams

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


@router.get("/transactions", response_model=Page[PaymentTransactionRead])
def list_payment_transactions(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return payment_service.list_payment_transactions(
        db, user, skip=pagination.skip, limit=pagination.limit
    )


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


@router.post("/verify/{provider}", response_model=PaymentVerificationAck)
def verify_payment_checkout(
    provider: str,
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db),
):
    return payment_service.verify_checkout_payment(
        db,
        provider=provider,
        gateway_order_id=payload.gateway_order_id,
        gateway_payment_id=payload.gateway_payment_id,
        signature=payload.signature,
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


@router.post("/withdrawals/reconcile", response_model=WithdrawalReconcileResult)
def reconcile_withdrawals(
    older_than_minutes: int = Query(15, ge=1, le=1440),
    retry_requested_limit: int = Query(20, ge=1, le=200),
    processing_limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin/ops endpoint to reconcile pending withdrawal payouts."""
    return payment_service.reconcile_withdrawals(
        db,
        older_than_minutes=older_than_minutes,
        retry_requested_limit=retry_requested_limit,
        processing_limit=processing_limit,
    )
