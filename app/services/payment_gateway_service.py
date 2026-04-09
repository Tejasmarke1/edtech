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


@dataclass(slots=True)
class GatewayPayoutRequest:
    amount: int
    currency: str
    reference_id: str
    fund_account_id: str
    mode: str = "UPI"
    narration: str | None = None
    notes: dict | None = None
    idempotency_key: str | None = None


@dataclass(slots=True)
class GatewayPayoutResponse:
    gateway: PaymentGateway
    payout_id: str
    status: str
    amount: int
    currency: str
    raw: dict


class PaymentGatewayClient(Protocol):
    gateway: PaymentGateway

    def create_order(self, payload: GatewayOrderRequest) -> GatewayOrderResponse:
        ...

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        ...

    def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
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

    def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        secret = settings.PAYMENT_WEBHOOK_SECRET or settings.SECRET_KEY
        payload = f"{order_id}|{payment_id}".encode("utf-8")
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

    def _post(self, path: str, *, key_id: str, key_secret: str, json_payload: dict, headers: dict | None = None) -> dict:
        response = httpx.post(
            f"{self._base_url}/{path.lstrip('/')}",
            auth=(key_id, key_secret),
            json=json_payload,
            headers=headers or {},
            timeout=20.0,
        )
        if response.status_code >= 400:
            raise BadRequestError(response.text or f"Razorpay API call failed for {path}")
        return response.json()

    def _get(self, path: str, *, key_id: str, key_secret: str) -> dict:
        response = httpx.get(
            f"{self._base_url}/{path.lstrip('/')}",
            auth=(key_id, key_secret),
            timeout=20.0,
        )
        if response.status_code >= 400:
            raise BadRequestError(response.text or f"Razorpay API call failed for {path}")
        return response.json()

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
        body = self._post(
            "orders",
            key_id=key_id,
            key_secret=key_secret,
            json_payload=request_json,
        )
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

    def create_contact(self, *, name: str, email: str | None, phone: str | None, notes: dict | None = None) -> str:
        key_id, key_secret = self._require_credentials()
        payload = {
            "name": name or "Teacher",
            "type": "employee",
            "reference_id": (notes or {}).get("teacher_id") if notes else None,
            "notes": notes or {},
        }
        if email:
            payload["email"] = email
        if phone:
            payload["contact"] = phone

        body = self._post(
            "contacts",
            key_id=key_id,
            key_secret=key_secret,
            json_payload=payload,
        )
        contact_id = str(body.get("id", "")).strip()
        if not contact_id:
            raise BadRequestError("Invalid Razorpay contact response")
        return contact_id

    def create_upi_fund_account(
        self,
        *,
        contact_id: str,
        upi_id: str,
        account_holder_name: str,
    ) -> str:
        key_id, key_secret = self._require_credentials()
        payload = {
            "contact_id": contact_id,
            "account_type": "vpa",
            "vpa": {
                "address": upi_id,
            },
            "name": account_holder_name or "Teacher",
        }
        body = self._post(
            "fund_accounts",
            key_id=key_id,
            key_secret=key_secret,
            json_payload=payload,
        )
        fund_account_id = str(body.get("id", "")).strip()
        if not fund_account_id:
            raise BadRequestError("Invalid Razorpay fund account response")
        return fund_account_id

    def create_payout(self, payload: GatewayPayoutRequest) -> GatewayPayoutResponse:
        key_id, key_secret = self._require_credentials()
        if payload.currency.upper() != "INR":
            raise BadRequestError("Razorpay payouts currently support INR only")

        request_json = {
            "account_number": "2323230082737717",
            "fund_account_id": payload.fund_account_id,
            "amount": payload.amount * 100,
            "currency": payload.currency.upper(),
            "mode": payload.mode,
            "purpose": "payout",
            "queue_if_low_balance": True,
            "reference_id": payload.reference_id,
            "narration": payload.narration or "Teacher withdrawal",
            "notes": payload.notes or {},
        }
        headers = {}
        if payload.idempotency_key:
            headers["X-Payout-Idempotency"] = payload.idempotency_key

        body = self._post(
            "payouts",
            key_id=key_id,
            key_secret=key_secret,
            json_payload=request_json,
            headers=headers,
        )

        payout_id = str(body.get("id", "")).strip()
        status = str(body.get("status", "")).strip().lower()
        if not payout_id:
            raise BadRequestError("Invalid Razorpay payout response")

        amount_subunits = int(body.get("amount", request_json["amount"]))
        amount = amount_subunits // 100
        return GatewayPayoutResponse(
            gateway=self.gateway,
            payout_id=payout_id,
            status=status or "requested",
            amount=amount,
            currency=str(body.get("currency", payload.currency)).upper(),
            raw=body,
        )

    def get_payout(self, payout_id: str) -> GatewayPayoutResponse:
        key_id, key_secret = self._require_credentials()
        body = self._get(
            f"payouts/{payout_id}",
            key_id=key_id,
            key_secret=key_secret,
        )
        status = str(body.get("status", "")).strip().lower()
        amount_subunits = int(body.get("amount", 0))
        return GatewayPayoutResponse(
            gateway=self.gateway,
            payout_id=str(body.get("id", payout_id)),
            status=status,
            amount=amount_subunits // 100,
            currency=str(body.get("currency", "INR")).upper(),
            raw=body,
        )

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        secret = settings.PAYMENT_WEBHOOK_SECRET.strip()
        if not secret:
            raise BadRequestError("PAYMENT_WEBHOOK_SECRET is required for Razorpay")
        digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, signature)

    def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        secret = settings.PAYMENT_GATEWAY_KEY_SECRET.strip()
        if not secret:
            raise BadRequestError("PAYMENT_GATEWAY_KEY_SECRET is required for Razorpay")
        payload = f"{order_id}|{payment_id}".encode("utf-8")
        digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, signature)

    def parse_webhook(self, payload: dict) -> WebhookParseResult:
        event_type = str(payload.get("event", "")).strip()
        if event_type.startswith("payout."):
            payout_entity = (
                payload.get("payload", {})
                .get("payout", {})
                .get("entity", {})
            )
            payout_id = str(payout_entity.get("id", "")).strip()
            event_id = str(payload.get("event_id", "")).strip() or (
                f"{event_type}:{payout_id}" if event_type and payout_id else ""
            )
            if not event_type or not event_id:
                raise BadRequestError("Invalid Razorpay payout webhook payload")

            normalized_payload = {
                "event_id": event_id,
                "event_type": event_type,
                "data": {
                    "payout_id": payout_id,
                    "status": payout_entity.get("status"),
                    "amount_subunits": payout_entity.get("amount"),
                    "currency": payout_entity.get("currency"),
                    "reference_id": payout_entity.get("reference_id"),
                    "utr": payout_entity.get("utr"),
                    "failure_reason": payout_entity.get("failure_reason") or payout_entity.get("status_details"),
                    "fund_account_id": payout_entity.get("fund_account_id"),
                    "contact_id": payout_entity.get("contact_id"),
                },
                "raw": payload,
            }
            return WebhookParseResult(
                gateway=self.gateway,
                event_id=event_id,
                event_type=event_type,
                payload=normalized_payload,
            )

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
                "amount_subunits": payment_entity.get("amount"),
                "currency": payment_entity.get("currency"),
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
