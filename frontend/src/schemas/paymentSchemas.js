/**
 * Payment Schemas
 * Zod validation schemas for payment-related data
 */

import { z } from 'zod';

/**
 * Schema for creating a payment order request
 */
export const CreatePaymentOrderRequestSchema = z.object({
  session_id: z.string().uuid('Invalid session ID').nonempty(),
});

/**
 * Schema for payment order response
 */
export const PaymentOrderReadSchema = z.object({
  transaction_id: z.string(),
  session_id: z.string(),
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'refunded']),
  gateway: z.enum(['mock', 'razorpay', 'stripe']),
  gateway_order_id: z.string(),
  session_type: z.enum(['individual', 'group']),
  payer_id: z.string(),
  payee_id: z.string(),
  gross_amount: z.number().int().positive(),
  platform_charge: z.number().int().nonnegative(),
  commission_charge: z.number().int().nonnegative(),
  net_payout: z.number().int().nonnegative(),
  total_payable: z.number().int().positive(),
  currency: z.string().length(3),
});

/**
 * Schema for verifying payment request
 */
export const VerifyPaymentRequestSchema = z.object({
  gateway_order_id: z.string().nonempty('Order ID is required'),
  gateway_payment_id: z.string().nonempty('Payment ID is required'),
  signature: z.string().nonempty('Signature is required'),
});

/**
 * Schema for payment transaction read/display
 */
export const PaymentTransactionReadSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  payer_id: z.string(),
  payee_id: z.string(),
  gross_amount: z.number().int(),
  platform_charge: z.number().int(),
  commission_charge: z.number().int(),
  net_payout: z.number().int(),
  total_payable: z.number().int(),
  currency: z.string(),
  gateway: z.enum(['mock', 'razorpay', 'stripe']),
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'refunded']),
  gateway_order_id: z.string().nullable(),
  gateway_payment_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Schema for payment verification response
 */
export const PaymentVerificationAckSchema = z.object({
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'refunded']),
  transaction_id: z.string(),
  message: z.string(),
});

/**
 * Schema for monthly earnings response
 */
export const MonthlyEarningsReadSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  total_earned: z.number().int(),
  total_commission_charged: z.number().int(),
  total_captured_transactions: z.number().int(),
  transactions: z.array(PaymentTransactionReadSchema),
});

/**
 * Schema for withdrawal process request
 */
export const ProcessWithdrawalRequestSchema = z.object({
  withdrawal_id: z.string().nonempty(),
  success: z.boolean(),
});

/**
 * Schema for withdrawal process response
 */
export const WithdrawalProcessResultSchema = z.object({
  withdrawal_id: z.string(),
  status: z.enum(['pending', 'processing', 'success', 'failed']),
  message: z.string(),
});

/**
 * Schema for user information in payment context
 */
export const PaymentUserInfoSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

/**
 * Composite schema for initiating a payment
 */
export const InitiatePaymentSchema = z.object({
  sessionId: z.string().uuid(),
  userInfo: PaymentUserInfoSchema,
});
