# Razorpay Integration - Quick Reference Guide

## 🚀 5-Minute Setup

### 1. Backend .env
```bash
PAYMENT_GATEWAY=razorpay
PAYMENT_GATEWAY_KEY_ID=rzp_test_xxxxx
PAYMENT_GATEWAY_KEY_SECRET=xxxxx
PAYMENT_WEBHOOK_SECRET=webhook_secret_xxxxx
```

### 2. Frontend .env.local
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

### 3. App.jsx
```jsx
<PaymentModal user={user} />
```

### 4. Session Page
```jsx
const openPaymentModal = usePaymentStore((state) => state.openPaymentModal);
openPaymentModal(sessionId, onSuccess, onFailure);
```

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useRazorpayPayment.js` | Payment logic hook |
| `frontend/src/api/paymentService.js` | API calls |
| `frontend/src/components/PaymentModal.jsx` | Payment UI |
| `frontend/src/stores/paymentStore.js` | State management |
| `frontend/src/schemas/paymentSchemas.js` | Validation |

---

## 🔑 Razorpay Credentials

### Get from: https://dashboard.razorpay.com/app/keys

1. **Key ID** (public) → `PAYMENT_GATEWAY_KEY_ID`
2. **Key Secret** (keep secret!) → `PAYMENT_GATEWAY_KEY_SECRET`
3. **Webhook Secret** → `PAYMENT_WEBHOOK_SECRET`

### Test vs Live
- **Test**: `rzp_test_xxxxx`
- **Live**: `rzp_live_xxxxx`

---

## 💰 Payment Amounts

All amounts are in **paise** (1 rupee = 100 paise):

```
₹5 = 500 paise
₹10 = 1000 paise
```

Environment variables:
```bash
PLATFORM_CHARGE_PER_USER=500         # ₹5
COMMISSION_PERCENT=20.0              # 20% of gross
```

---

## 🧪 Test Cards

```
Success: 4111 1111 1111 1111
Failure: 4000 0000 0000 0002
```

Expiry: Any future date
CVV: Any 3 digits

---

## 🔗 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/payments/orders` | Create order |
| POST | `/payments/verify/razorpay` | Verify payment |
| POST | `/payments/webhook/razorpay` | Receive webhook |
| GET | `/payments/transactions` | List payments |
| GET | `/payments/earnings/monthly` | Teacher earnings |

---

## 🔄 Payment Flow

```
User clicks "Pay" 
  ↓
Frontend creates order (POST /orders)
  ↓
Razorpay window opens
  ↓
User completes payment
  ↓
Both paths:
  - Webhook: Razorpay → Backend
  - Verify: Frontend → Backend
  ↓
Backend credits teacher wallet
  ↓
Frontend shows success
```

---

## ⚡ Hooks & Components

### useRazorpayPayment Hook
```jsx
const { initiatePayment, isLoading } = useRazorpayPayment();

await initiatePayment(sessionId, userInfo, onSuccess, onFailure);
```

### PaymentModal Component
```jsx
<PaymentModal user={user} />
```

### Payment Store
```jsx
const openPaymentModal = usePaymentStore((s) => s.openPaymentModal);
openPaymentModal(sessionId, onSuccess, onFailure);
```

---

## 🔐 Security Checklist

- [ ] Keep Key Secret secret (backend only)
- [ ] Verify webhook signatures
- [ ] Use HTTPS in production
- [ ] Restrict CORS origins
- [ ] Use JWT authentication
- [ ] Never log payment details
- [ ] Rotate webhook secret regularly

---

## ✅ Testing Checklist

- [ ] Order creation works
- [ ] Payment window opens
- [ ] Success payment captured
- [ ] Failed payment handled
- [ ] Webhook received
- [ ] Teacher wallet credited
- [ ] Transaction in database
- [ ] Monthly earnings calculated

---

## 📊 Database Schema (Quick View)

### PaymentTransaction
- `id` - UUID primary key
- `session_id` - FK to session
- `payer_id` - Student username
- `payee_id` - Teacher username
- `total_payable` - Amount in paise
- `status` - created, captured, failed
- `gateway_order_id` - Razorpay order ID
- `gateway_payment_id` - Razorpay payment ID

### PaymentEvent
- `id` - UUID primary key
- `event_id` - Razorpay event ID
- `event_type` - payment.captured, etc
- `status` - received, processed
- `payload` - Full webhook data

---

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Modal won't open | Check VITE_RAZORPAY_KEY_ID |
| Payment fails | Check Key Secret matches |
| Webhook doesn't arrive | Verify webhook URL in Razorpay |
| Wallet not credited | Check PaymentTransaction status |

---

## 📞 Key Contacts

- **Razorpay Support**: support@razorpay.com
- **Razorpay Docs**: https://razorpay.com/docs/
- **Test Cards**: https://razorpay.com/docs/payments/payments-test-cards/

---

## 🎯 Environment Variables Summary

```bash
# Backend (.env)
PAYMENT_GATEWAY=razorpay
PAYMENT_CURRENCY=INR
PAYMENT_GATEWAY_KEY_ID=rzp_test_xxxxx
PAYMENT_GATEWAY_KEY_SECRET=xxxxx
PAYMENT_WEBHOOK_SECRET=webhook_xxxxx
PLATFORM_CHARGE_PER_USER=500
COMMISSION_PERCENT=20.0

# Frontend (.env.local)
VITE_API_BASE_URL=http://localhost:8000
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

---

## 💡 Pro Tips

1. **Test Mode First** - Always start with `rzp_test_` credentials
2. **Check Logs** - Backend logs show webhook details
3. **Postman Testing** - Use provided Postman collection
4. **Webhook Testing** - Test manually in Razorpay Dashboard
5. **Amount Formats** - Remember: amounts in paise

---

## 📋 Pre-Production Checklist

### Before going LIVE:

- [ ] Switch to live credentials (`rzp_live_`)
- [ ] Update PAYMENT_WEBHOOK_SECRET
- [ ] Test with real payment
- [ ] Verify webhook delivery
- [ ] Set up monitoring
- [ ] Configure error alerts
- [ ] Train support team
- [ ] Document processes

---

**Created**: April 2026
**Status**: Ready for deployment
**Next**: Update .env and start testing!
