"""Gateway abstraction scaffold for Phase 1 payment integration."""

from dataclasses import dataclass
import hashlib
import hmac
from typing import Protocol

import httpx

from app.config import settings
from app.models.payment import PaymentGateway
from app.utils.exceptions import BadRequestError


@dataclass(slots=True)
class GatewayOrderRequest:
    amount: int
    currency: str
    reference_id: str
    notes: dict | None = None


@dataclass(slots=True)
class GatewayOrderResponse:
    gateway: PaymentGateway
    order_id: str
    amount: int
    currency: str
    raw: dict


@dataclass(slots=True)
class WebhookParseResult:
    gateway: PaymentGateway
    event_id: str
    event_type: str
    payload: dict


class PaymentGatewayClient(Protocol):
    gateway: PaymentGateway

    def create_order(self, payload: GatewayOrderRequest) -> GatewayOrderResponse:
        ...

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        ...

    def parse_webhook(self, payload: dict) -> WebhookParseResult:
        ...


class MockGatewayClient:
    """Placeholder implementation until provider SDK integration in Phase 2."""

    gateway = PaymentGateway.mock

    def create_order(self, payload: GatewayOrderRequest) -> GatewayOrderResponse:
        return GatewayOrderResponse(
            gateway=self.gateway,
            order_id=f"mock_order_{payload.reference_id}",
            amount=payload.amount,
            currency=payload.currency,
            raw={"provider": "mock", "reference_id": payload.reference_id},
        )

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        secret = settings.PAYMENT_WEBHOOK_SECRET or settings.SECRET_KEY
        digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, signature)

    def parse_webhook(self, payload: dict) -> WebhookParseResult:
        event_id = str(payload.get("event_id", "")).strip()
        event_type = str(payload.get("event_type", "")).strip()
        if not event_id or not event_type:
            raise BadRequestError("Invalid webhook payload")
        return WebhookParseResult(
            gateway=self.gateway,
            event_id=event_id,
            event_type=event_type,
            payload=payload,
        )


class RazorpayGatewayClient:
    """Razorpay adapter for test/live mode order creation and webhook parsing."""

    gateway = PaymentGateway.razorpay
    _base_url = "https://api.razorpay.com/v1"

    def _require_credentials(self) -> tuple[str, str]:
        key_id = settings.PAYMENT_GATEWAY_KEY_ID.strip()
        key_secret = settings.PAYMENT_GATEWAY_KEY_SECRET.strip()
        if not key_id or not key_secret:
            raise BadRequestError("Razorpay credentials are not configured")
        return key_id, key_secret

    def create_order(self, payload: GatewayOrderRequest) -> GatewayOrderResponse:
        key_id, key_secret = self._require_credentials()
        if payload.currency.upper() != "INR":
            raise BadRequestError("Razorpay integration currently supports INR only")

        request_json = {
            "amount": payload.amount * 100,
            "currency": payload.currency.upper(),
            "receipt": payload.reference_id[:40],
            "notes": payload.notes or {},
        }
        response = httpx.post(
            f"{self._base_url}/orders",
            auth=(key_id, key_secret),
            json=request_json,
            timeout=15.0,
        )
        if response.status_code >= 400:
            raise BadRequestError("Failed to create Razorpay order")
        body = response.json()
        order_id = str(body.get("id", "")).strip()
        if not order_id:
            raise BadRequestError("Invalid Razorpay order response")

        amount_subunits = int(body.get("amount", request_json["amount"]))
        amount = amount_subunits // 100
        return GatewayOrderResponse(
            gateway=self.gateway,
            order_id=order_id,
            amount=amount,
            currency=str(body.get("currency", payload.currency)).upper(),
            raw=body,
        )

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        secret = settings.PAYMENT_WEBHOOK_SECRET.strip()
        if not secret:
            raise BadRequestError("PAYMENT_WEBHOOK_SECRET is required for Razorpay")
        digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, signature)

    def parse_webhook(self, payload: dict) -> WebhookParseResult:
        event_type = str(payload.get("event", "")).strip()
        payment_entity = (
            payload.get("payload", {})
            .get("payment", {})
            .get("entity", {})
        )
        payment_id = str(payment_entity.get("id", "")).strip()
        event_id = str(payload.get("event_id", "")).strip() or (
            f"{event_type}:{payment_id}" if event_type and payment_id else ""
        )
        if not event_type or not event_id:
            raise BadRequestError("Invalid Razorpay webhook payload")
        normalized_payload = {
            "event_id": event_id,
            "event_type": event_type,
            "data": {
                "order_id": payment_entity.get("order_id"),
                "payment_id": payment_id or None,
                "status": payment_entity.get("status"),
            },
            "raw": payload,
        }
        return WebhookParseResult(
            gateway=self.gateway,
            event_id=event_id,
            event_type=event_type,
            payload=normalized_payload,
        )


def get_gateway_client(gateway_name: str) -> PaymentGatewayClient:
    """Factory scaffold; real gateway clients will be registered in Phase 2."""
    if gateway_name == PaymentGateway.mock.value:
        return MockGatewayClient()
    if gateway_name == PaymentGateway.razorpay.value:
        return RazorpayGatewayClient()
    raise BadRequestError(f"Unsupported payment gateway '{gateway_name}'")
