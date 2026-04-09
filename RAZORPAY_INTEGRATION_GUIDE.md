# Razorpay Payment Gateway Integration Guide

## Overview

This document provides comprehensive setup and implementation instructions for integrating Razorpay payment gateway with the ED-Tech platform.

## Prerequisites

- Razorpay account (https://razorpay.com)
- Razorpay API credentials (Key ID and Key Secret)
- Razorpay Webhook Secret (optional, for webhook security)

## Environment Variables Configuration

Add the following variables to your `.env` file:

### Payment Gateway Settings

```env
# Payment Gateway Selection
PAYMENT_GATEWAY=razorpay              # Options: mock, razorpay, stripe
PAYMENT_CURRENCY=INR                  # Currency code (Razorpay currently supports INR only)

# Razorpay Credentials (from https://dashboard.razorpay.com/app/keys)
PAYMENT_GATEWAY_KEY_ID=rzp_live_xxxxx        # Your Razorpay Key ID (public key)
PAYMENT_GATEWAY_KEY_SECRET=xxxxx              # Your Razorpay Key Secret
PAYMENT_WEBHOOK_SECRET=webhook_secret_xxxxx  # Webhook signature secret (from Webhook Settings)

# Platform Charges (in paise, e.g., 500 = ₹5)
PLATFORM_CHARGE_PER_USER=500                 # Default platform charge per user
PLATFORM_CHARGE_PER_USER_INDIVIDUAL=500      # Platform charge for 1-on-1 sessions
PLATFORM_CHARGE_PER_USER_GROUP=300           # Platform charge for group sessions

# Commission Rates (percentage)
COMMISSION_PERCENT=20                        # Default commission percentage
COMMISSION_PERCENT_INDIVIDUAL=20             # Commission for 1-on-1 sessions
COMMISSION_PERCENT_GROUP=15                  # Commission for group sessions
```

### Frontend Environment Variables

Add to your frontend `.env` or `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000     # Backend API URL
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxx         # Razorpay Key ID (public key only)
```

## Razorpay Account Setup

### 1. Get API Credentials

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Go to **Settings** → **API Keys**
3. Copy your **Key ID** (public key) and **Key Secret**
4. Note: Keep Key Secret secure; never commit to version control

### 2. Create a Webhook

1. Go to **Settings** → **Webhooks**
2. Click **Add New Webhook**
3. Enter the webhook URL: `https://your-domain.com/payments/webhook/razorpay`
4. Select events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `invoice.paid` (optional)
5. Copy the **Webhook Secret**
6. Activate the webhook

### 3. Test Credentials (Optional)

For testing, Razorpay provides test credentials:

- **Test Key ID**: `rzp_test_xxxxx`
- **Test Key Secret**: `xxxxx`
- **Test Payment Cards**: https://razorpay.com/docs/payments/payments-test-cards/

## Backend Setup

### 1. Verify Python Dependencies

The backend uses `httpx` for HTTP requests. Ensure `pyproject.toml` includes:

```toml
[tool.poetry.dependencies]
httpx = "^0.28.1"
python-jose = {extras = ["cryptography"], version = "^3.5.0"}
```

### 2. Verify Models

Payment models are already defined in `app/models/payment.py`:

- `PaymentTransaction` - Tracks payment transactions
- `PaymentEvent` - Tracks webhook events
- `PaymentGateway` enum - Supports 'razorpay', 'stripe', 'mock'
- `PaymentStatus` enum - created, authorized, captured, failed, refunded

### 3. API Routes

Payment routes are already set up in `app/routers/payments.py`:

- `POST /payments/orders` - Create payment order
- `POST /payments/verify/{provider}` - Verify payment
- `POST /payments/webhook/{provider}` - Webhook receiver
- `GET /payments/transactions` - List transactions
- `GET /payments/transactions/{id}` - Get transaction details
- `GET /payments/earnings/monthly` - Get monthly earnings (teachers)

### 4. Service Implementation

Payment service is in `app/services/payment_service.py` with support for:

- Order creation
- Payment verification
- Webhook processing
- Earnings calculation

## Frontend Integration

### 1. Add Payment Modal to App Layout

```jsx
// In your main App.jsx or layout component
import PaymentModal from './components/PaymentModal';
import { useAuthStore } from './stores/authStore';

function App() {
  const user = useAuthStore((state) => state.user);

  return (
    <>
      {/* Your existing UI */}
      <PaymentModal user={user} />
    </>
  );
}
```

### 2. Trigger Payment from Session Detail

```jsx
import { usePaymentStore } from '../stores/paymentStore';

function SessionDetailPage({ sessionId }) {
  const openPaymentModal = usePaymentStore((state) => state.openPaymentModal);
  const user = useAuthStore((state) => state.user);

  const handlePaymentClick = () => {
    openPaymentModal(
      sessionId,
      // onSuccess callback
      (paymentData) => {
        console.log('Payment successful:', paymentData);
        // Redirect or refresh session
        navigate(`/sessions/${sessionId}`);
      },
      // onFailure callback
      (error) => {
        console.error('Payment failed:', error);
      }
    );
  };

  return (
    <div>
      <h1>Session Details</h1>
      {/* Session info */}
      <button onClick={handlePaymentClick} className="btn btn-primary">
        Pay Now
      </button>
    </div>
  );
}
```

### 3. Hook Usage Example

```jsx
import useRazorpayPayment from '../hooks/useRazorpayPayment';
import { createPaymentOrder, verifyPayment } from '../api/paymentService';

function CustomPaymentComponent() {
  const { initiatePayment, isLoading, error } = useRazorpayPayment();

  const handlePayment = async () => {
    await initiatePayment(
      'session-id-123',
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
      },
      (data) => {
        console.log('Payment success:', data);
      },
      (error) => {
        console.error('Payment error:', error);
      }
    );
  };

  return (
    <button onClick={handlePayment} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Pay with Razorpay'}
    </button>
  );
}
```

## Payment Flow Diagram

```
User -> Click "Pay Now"
  ↓
Frontend: openPaymentModal(sessionId)
  ↓
Backend: POST /payments/orders
  ↓
  Create PaymentTransaction (status: created)
  ↓
  Call Razorpay API: create order
  ↓
  Return gateway_order_id
  ↓
Frontend: Open Razorpay Checkout
  ↓
User: Enter payment details
  ↓
Razorpay: Process payment
  ↓
  Success: Send webhook to /payments/webhook/razorpay
  ↓
Backend: 
  - Verify signature
  - Create PaymentEvent
  - Get PaymentTransaction
  - If payment.captured: Update status to captured
  - Credit teacher wallet
  ↓
  Also: Send verification response to frontend
  ↓
Frontend: POST /payments/verify/razorpay
  ↓
Backend: Verify payment with database
  ↓
Frontend: Show success message
  ↓
Update UI and redirect
```

## Error Handling

### Common Scenarios

1. **User Cancels Payment**
   - Modal closes automatically
   - Transaction remains in 'created' state
   - Can retry with same transaction already exists

2. **Payment Fails**
   - Transaction marked as 'failed'
   - User can retry and create new order
   - Webhook handler ignores failure if already captured

3. **Network Issues**
   - Frontend timeout: Modal closes, user can retry
   - Webhook delivery: Razorpay retries for 24 hours
   - Verification endpoint: Can verify again with order_id

4. **Signature Mismatch**
   - Webhook rejected with 400 error
   - Razorpay retries the webhook
   - Check PAYMENT_WEBHOOK_SECRET is correct

## Testing

### Test Payment Cards

Use these cards in test mode:

| Card Number | Expiry | CVV | Use Case |
|---|---|---|---|
| 4111111111111111 | 12/25 | 123 | Success |
| 4000000000000002 | 12/25 | 123 | Failure |
| 4000002500003155 | 12/25 | 123 | 3D Secure |

### Postman Collection

```json
{
  "info": {
    "name": "Razorpay Payment API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Payment Order",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/payments/orders",
        "body": {
          "raw": "{\"session_id\": \"uuid-here\"}"
        }
      }
    },
    {
      "name": "Verify Payment",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/payments/verify/razorpay",
        "body": {
          "raw": "{\"gateway_order_id\": \"order_id\", \"gateway_payment_id\": \"pay_id\", \"signature\": \"sig\"}"
        }
      }
    }
  ]
}
```

## Troubleshooting

### Issue: Payment modal doesn't open

**Solution:**
1. Check `VITE_RAZORPAY_KEY_ID` in frontend `.env`
2. Verify Key ID is not blank
3. Check browser console for errors
4. Ensure Razorpay script loads from CDN

### Issue: Payment verification fails

**Solution:**
1. Verify `PAYMENT_GATEWAY_KEY_SECRET` matches Razorpay
2. Check webhook secret for webhook-based verification
3. Ensure order_id and payment_id are correct
4. Check backend logs for signature mismatch

### Issue: Webhook not being received

**Solution:**
1. Verify webhook URL is publicly accessible
2. Check webhook is enabled in Razorpay Dashboard
3. Verify `PAYMENT_WEBHOOK_SECRET` matches webhook settings
4. Check backend logs at `/logs` endpoint
5. Test webhook manually in Razorpay Dashboard

### Issue: Teacher wallet not credited

**Solution:**
1. Verify webhook payment.captured event received
2. Check transaction status is 'captured' in database
3. Verify teacher_id in PaymentTransaction matches teacher wallet
4. Check PaymentEvent status is 'processed'
5. Run manual verification: `POST /payments/verify/razorpay`

## Database Schema

### PaymentTransaction Table

```sql
id                  VARCHAR(255) PRIMARY KEY
session_id          VARCHAR(255) FOREIGN KEY
payer_id            VARCHAR(255) FOREIGN KEY (payer's username)
payee_id            VARCHAR(255) FOREIGN KEY (teacher's username)
gross_amount        INTEGER (amount in rupees)
platform_charge     INTEGER (deducted from payer)
commission_charge   INTEGER (deducted from payer earnings)
net_payout          INTEGER (credited to teacher)
total_payable       INTEGER (gross + platform charge)
currency            VARCHAR(10)
gateway             ENUM (razorpay, stripe, mock)
status              ENUM (created, authorized, captured, failed, refunded)
gateway_order_id    VARCHAR(255) UNIQUE
gateway_payment_id  VARCHAR(255) UNIQUE
gateway_signature   VARCHAR(500)
gateway_metadata    JSON
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

### PaymentEvent Table

```sql
id                  VARCHAR(255) PRIMARY KEY
gateway             ENUM (razorpay)
event_id            VARCHAR(255) UNIQUE
event_type          VARCHAR(255)
transaction_id      VARCHAR(255) FOREIGN KEY
status              ENUM (received, processed, ignored, failed)
payload             JSON
processing_error    TEXT
created_at          TIMESTAMP
```

## Security Considerations

1. **Key Management**
   - Never expose Key Secret in frontend code
   - Use backend API to create orders and verify
   - Rotate webhook secret periodically

2. **Signature Verification**
   - Always verify webhook signatures server-side
   - Use HMAC-SHA256 for verification
   - Reject unsigned webhooks

3. **HTTPS Requirement**
   - Always use HTTPS in production
   - Set secure flag on webhook URLs
   - Use TLS 1.2 or higher

4. **Idempotency**
   - Payment orders use idempotency keys
   - Prevents duplicate charges
   - Based on session_id + payer_id + amount

5. **PCI Compliance**
   - Never log payment details
   - Use Razorpay Checkout for all payments
   - Don't store raw card data

## Support & Documentation

- **Razorpay Docs**: https://razorpay.com/docs/
- **Payment Gateway API**: https://razorpay.com/docs/api/
- **Webhook Help**: https://razorpay.com/docs/webhooks/
- **Test Cards**: https://razorpay.com/docs/payments/payments-test-cards/

## Next Steps

1. ✅ Set up Razorpay account and get credentials
2. ✅ Add environment variables to `.env`
3. ✅ Add PaymentModal to App layout
4. ✅ Set up webhook in Razorpay Dashboard
5. ✅ Test with test payment cards
6. ✅ Deploy to production with live credentials
