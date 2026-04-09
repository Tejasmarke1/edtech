/**
 * useRazorpayPayment Hook
 * Manages Razorpay payment window integration and verification
 * Handles payment lifecycle: order creation → payment → verification
 */

import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { verifyPayment, createPaymentOrder, getTransaction } from '../api/paymentService';

/**
 * Load Razorpay script dynamically from CDN
 * @returns {Promise<boolean>} - True if script loaded successfully
 */
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      resolve(false);
    };
    document.head.appendChild(script);
  });
};

const isValidEmail = (value) =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const normalizePhone = (value) => {
  if (typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  // Razorpay accepts contact in national/international numeric format.
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mapPaymentErrorMessage = (error) => {
  const raw = String(error?.message || error || 'Payment failed');
  const normalized = raw.toLowerCase();

  if (normalized.includes('payment cancelled')) return 'Payment was cancelled. You can retry anytime.';
  if (normalized.includes('international') && normalized.includes('not enabled')) {
    return 'International card payments are disabled on this Razorpay account. Use UPI, netbanking, or wallet.';
  }
  if (normalized.includes('failed to load razorpay')) {
    return 'Unable to load Razorpay checkout. Please check your connection and retry.';
  }
  if (normalized.includes('missing razorpay key')) {
    return 'Payment is not configured properly. Please contact support.';
  }
  if (normalized.includes('signature') || normalized.includes('verification')) {
    return 'Payment verification failed. If amount was debited, it will be reconciled shortly.';
  }
  return raw;
};

async function createOrderWithRetry(sessionId, attempts = 2) {
  let lastError;
  for (let i = 0; i <= attempts; i += 1) {
    try {
      return await createPaymentOrder(sessionId);
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        await delay(400 * (i + 1));
      }
    }
  }
  throw lastError;
}

async function waitForCapturedStatus(transactionId, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    await delay(1000 * (i + 1));
    try {
      const tx = await getTransaction(transactionId);
      if (String(tx?.status || '').toLowerCase() === 'captured') return true;
    } catch {
      // Keep polling for transient fetch failures.
    }
  }
  return false;
}

/**
 * Main hook for handling Razorpay payment flow
 * @returns {Object} - Payment state and functions
 */
export const useRazorpayPayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const transactionIdRef = useRef(null);

  // Card payments can trigger "international payment not enabled" on some Razorpay accounts.
  // Keep it opt-in for local/dev usage until account capabilities are configured.
  const enableCardPayments =
    String(import.meta.env.VITE_RAZORPAY_ENABLE_CARD || 'false').toLowerCase() === 'true';

  /**
   * Initialize and open Razorpay payment window
   * @param {string} sessionId - Session ID to pay for
   * @param {Object} userInfo - User information { name, email, phone }
   * @param {Function} onSuccess - Callback on successful payment
   * @param {Function} onFailure - Callback on failed payment
   */
  const initiatePayment = useCallback(
    async (sessionId, userInfo, onSuccess, onFailure, existingOrder = null) => {
      try {
        setIsLoading(true);
        setError(null);

        if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
          throw new Error('Payment is not configured. Missing Razorpay key.');
        }

        // Step 1: Load Razorpay script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Failed to load Razorpay. Please check your internet connection.');
        }

        // Step 2: Create payment order from backend (or reuse previewed order)
        let orderResponse = existingOrder;
        if (!orderResponse) {
          toast.loading('Creating payment order...', { id: 'payment-order' });
          orderResponse = await createOrderWithRetry(sessionId, 2);
          toast.dismiss('payment-order');
        }

        transactionIdRef.current = orderResponse.transaction_id;
        toast.loading('Opening payment window...', { id: 'payment-window' });

        // Step 3: Open Razorpay payment window
        const sanitizedEmail = isValidEmail(userInfo.email) ? userInfo.email.trim() : '';
        const sanitizedPhone = normalizePhone(userInfo.phone);
        const sanitizedName = typeof userInfo.name === 'string' ? userInfo.name.trim() : '';

        const prefill = {};
        if (sanitizedName) prefill.name = sanitizedName;
        if (sanitizedEmail) prefill.email = sanitizedEmail;
        if (sanitizedPhone) prefill.contact = sanitizedPhone;

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Public key from frontend env
          // With order_id flow, Razorpay reads amount/currency from the server-created order.
          name: 'ED-Tech Platform',
          description: `Session Payment - ₹${orderResponse.total_payable}`,
          order_id: orderResponse.gateway_order_id, // Order ID from Razorpay
          
          // User prefill
          prefill,

          // Payment method options
          method: {
            emandate: false,
            netbanking: true,
            card: enableCardPayments,
            wallet: true,
            upi: true,
          },

          // Theme customization
          theme: {
            color: '#3b82f6', // Tailwind blue-500
          },

          // Callback handlers
          handler: (response) => {
            handlePaymentSuccess(
              response,
              orderResponse,
              onSuccess,
              onFailure,
            );
          },

          // Additional options
          modal: {
            ondismiss: () => {
              toast.dismiss('payment-window');
              setIsLoading(false);
              if (onFailure) {
                onFailure(new Error('Payment cancelled by user'));
              }
            },
            confirm_close: true,
            escape: true,
          },

          // Display options
          readonly: {
            email: !sanitizedEmail,
            contact: !sanitizedPhone,
          },

          // Customized buttons
          notes: {
            session_id: sessionId,
            platform: 'ED-Tech',
          },
        };

        const razorpay = new window.Razorpay(options);
        
        razorpay.on('payment.failed', (response) => {
          toast.dismiss('payment-window');
          handlePaymentFailure(response, onFailure);
        });

        razorpay.open();
      } catch (err) {
        toast.dismiss('payment-order');
        toast.dismiss('payment-window');
        setError(mapPaymentErrorMessage(err));
        if (onFailure) {
          onFailure(new Error(mapPaymentErrorMessage(err)));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * Handle successful payment
   * Verify payment with backend and trigger callback
   */
  const handlePaymentSuccess = useCallback(
    async (razorpayResponse, orderResponse, onSuccess, onFailure) => {
      try {
        setIsProcessing(true);
        toast.dismiss('payment-window');
        toast.loading('Verifying payment...', { id: 'payment-verify' });

        // Step 4: Verify payment with backend
        const verifyResponse = await verifyPayment({
          gateway_order_id: orderResponse.gateway_order_id,
          gateway_payment_id: razorpayResponse.razorpay_payment_id,
          signature: razorpayResponse.razorpay_signature,
        });

        toast.dismiss('payment-verify');

        const verifiedStatus = String(verifyResponse.transaction_status || '').toLowerCase();
        const verificationTransactionId = verifyResponse.transaction_id || transactionIdRef.current;

        if (verifiedStatus === 'captured') {
          toast.success(
            `Payment successful! ₹${orderResponse.total_payable} received.`,
            { id: 'payment-success' },
          );

          // Call success callback
          if (onSuccess) {
            onSuccess({
              transactionId: transactionIdRef.current,
              paymentId: razorpayResponse.razorpay_payment_id,
              orderId: orderResponse.gateway_order_id,
              amount: orderResponse.total_payable,
              currency: orderResponse.currency,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          toast.loading('Finalizing payment status...', { id: 'payment-finalize' });
          const captured = verificationTransactionId
            ? await waitForCapturedStatus(verificationTransactionId, 3)
            : false;
          toast.dismiss('payment-finalize');

          if (captured) {
            toast.success(
              `Payment successful! ₹${orderResponse.total_payable} received.`,
              { id: 'payment-success' },
            );
            if (onSuccess) {
              onSuccess({
                transactionId: verificationTransactionId,
                paymentId: razorpayResponse.razorpay_payment_id,
                orderId: orderResponse.gateway_order_id,
                amount: orderResponse.total_payable,
                currency: orderResponse.currency,
                timestamp: new Date().toISOString(),
              });
            }
            return;
          }

          throw new Error(
            `Payment is submitted but confirmation is pending. Current status: ${verifyResponse.transaction_status || 'unknown'}.`,
          );
        }
      } catch (err) {
        toast.dismiss('payment-verify');
        toast.error(
          mapPaymentErrorMessage(err),
          { id: 'payment-error' },
        );
        if (onFailure) {
          onFailure(new Error(mapPaymentErrorMessage(err)));
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  /**
   * Handle payment failure
   */
  const handlePaymentFailure = useCallback((response, onFailure) => {
    try {
      setIsProcessing(false);
      let errorMsg = 'Payment failed';

      if (response.error) {
        const { code, description, reason } = response.error;
        errorMsg = `${code}: ${description || reason || errorMsg}`;
      }

      const normalized = String(errorMsg).toLowerCase();
      if (normalized.includes('international') && normalized.includes('not enabled')) {
        errorMsg = 'International card payments are disabled on this Razorpay account. Please use UPI, netbanking, or wallet.';
      }

      if (normalized.includes('payment cancelled by user')) {
        errorMsg = 'Payment was cancelled. You can retry whenever you are ready.';
      }

      toast.error(
        `Payment failed: ${mapPaymentErrorMessage(errorMsg)}. Please try again.`,
        { id: 'payment-failure' },
      );

      if (onFailure) {
        onFailure(new Error(mapPaymentErrorMessage(errorMsg)));
      }
    } catch (err) {
      console.error('Error handling payment failure:', err);
      toast.error(
        'An unexpected error occurred. Please try again.',
        { id: 'payment-error' },
      );
    }
  }, []);

  /**
   * Reset payment state (call after payment completion)
   */
  const resetPaymentState = useCallback(() => {
    setError(null);
    setIsLoading(false);
    setIsProcessing(false);
    transactionIdRef.current = null;
  }, []);

  return {
    initiatePayment,
    resetPaymentState,
    isLoading,
    isProcessing,
    error,
    transactionId: transactionIdRef.current,
  };
};

export default useRazorpayPayment;
