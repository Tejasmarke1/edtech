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
