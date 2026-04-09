"""Teacher wallet & withdrawal schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.wallet import WithdrawalStatus


class WalletRead(BaseModel):
    id: str
    teacher_id: str
    total_earned: int
    total_withdraw: int
    current_balance: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class WithdrawalRequest(BaseModel):
    amount: int = Field(..., gt=0)


class WithdrawalRead(BaseModel):
    id: str
    teacher_id: str
    amount: int
    status: WithdrawalStatus
    request_at: datetime
    processed_at: datetime | None = None
    gateway: str | None = None
    idempotency_key: str
    gateway_contact_id: str | None = None
    gateway_fund_account_id: str | None = None
    gateway_payout_id: str | None = None
    gateway_metadata: dict | None = None
    last_error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Payment schemas ----------
class CreatePaymentOrderRequest(BaseModel):
    session_id: str


class PaymentOrderRead(BaseModel):
    transaction_id: str
    gateway: str
    gateway_order_id: str
    status: str
    session_id: str
    session_type: str
    payer_id: str
    payee_id: str
    gross_amount: int
    platform_charge: int
    commission_charge: int
    net_payout: int
    total_payable: int
    currency: str = "INR"


class PaymentTransactionRead(BaseModel):
    transaction_id: str
    gateway: str
    gateway_order_id: str | None = None
    gateway_payment_id: str | None = None
    status: str
    session_id: str
    payer_id: str
    payee_id: str
    gross_amount: int
    platform_charge: int
    commission_charge: int
    net_payout: int
    total_payable: int
    currency: str


class PaymentWebhookAck(BaseModel):
    event_id: str
    transaction_id: str | None = None
    event_status: str
    transaction_status: str | None = None


class VerifyPaymentRequest(BaseModel):
    gateway_order_id: str
    gateway_payment_id: str
    signature: str


class PaymentVerificationAck(BaseModel):
    transaction_id: str
    session_id: str
    gateway: str
    gateway_order_id: str | None = None
    gateway_payment_id: str | None = None
    verification_status: str
    transaction_status: str


class MonthlyEarningsRead(BaseModel):
    year: int
    month: int
    sessions_completed: int
    amount_earned: int


class ProcessWithdrawalRequest(BaseModel):
    withdrawal_id: str
    success: bool

class WithdrawalProcessResult(BaseModel):
    id: str
    teacher_id: str
    amount: int
    status: str
    gateway_payout_id: str | None = None
    processed_at: str | None = None


class WithdrawalReconcileResult(BaseModel):
    scanned_requested: int
    retried_requested: int
    scanned_processing: int
    finalized_success: int
    finalized_failed: int
