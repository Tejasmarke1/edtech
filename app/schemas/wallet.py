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
    processed_at: str | None = None
