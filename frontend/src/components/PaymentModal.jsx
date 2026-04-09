/**
 * Payment Modal Component
 * Reusable modal for initiating Razorpay payments
 * Usage: wrap it in the component tree and use paymentStore to trigger
 */

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useRazorpayPayment from '../hooks/useRazorpayPayment';
import { usePaymentStore } from '../stores/paymentStore';
import { createPaymentOrder } from '../api/paymentService';
import toast from 'react-hot-toast';

const formatCurrency = (amount = 0, currency = 'INR') => {
  const numericAmount = Number(amount || 0);
  if (currency === 'INR') {
    return `₹${numericAmount}`;
  }
  return `${currency} ${numericAmount}`;
};

const PaymentModal = ({ user }) => {
  const { initiatePayment, resetPaymentState, isLoading, isProcessing, error } =
    useRazorpayPayment();

  const { isOpen, sessionId, onSuccess, onFailure, closePaymentModal } =
    usePaymentStore(
      useShallow((state) => ({
        isOpen: state.isOpen,
        sessionId: state.sessionId,
        onSuccess: state.onSuccess,
        onFailure: state.onFailure,
        closePaymentModal: state.closePaymentModal,
      })),
    );

  const [paymentDetails, setPaymentDetails] = useState(null);
  const [orderPreview, setOrderPreview] = useState(null);
  const [isPreparingOrder, setIsPreparingOrder] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPaymentDetails(null);
      setOrderPreview(null);
      setIsPreparingOrder(false);
      resetPaymentState();
      return;
    }

    // New open should always start in initiation mode.
    setPaymentDetails(null);
    setOrderPreview(null);
    setIsPreparingOrder(false);
    resetPaymentState();
  }, [isOpen, sessionId, resetPaymentState]);

  const profile = user?.profile || {};
  const displayName =
    profile.full_name || user?.full_name || user?.name || user?.user_name || '';
  const displayEmail = profile.email || user?.email || user?.user_name || '';
  const displayPhone =
    profile.phone_number ||
    profile.phone ||
    user?.phone_number ||
    user?.phone ||
    '';

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handlePrepareOrder = async () => {
    if (!sessionId) {
      toast.error('Missing session information');
      return;
    }

    setIsPreparingOrder(true);
    try {
      const order = await createPaymentOrder(sessionId);
      setOrderPreview(order);
      toast.success('Payment summary is ready. Please review and continue.');
    } catch (err) {
      toast.error(err?.message || 'Failed to prepare payment summary.');
      setOrderPreview(null);
    } finally {
      setIsPreparingOrder(false);
    }
  };

  const handlePaymentInitiation = async () => {
    if (!sessionId || !user) {
      toast.error('Missing session or user information');
      return;
    }

    const userInfo = {
      name: displayName,
      email: displayEmail,
      phone: displayPhone,
    };

    try {
      await initiatePayment(
        sessionId,
        userInfo,
        (paymentData) => {
          setPaymentDetails(paymentData);
          // Call the success callback
          if (onSuccess) {
            onSuccess(paymentData);
          }
          // Auto-close modal on success
          setTimeout(() => {
            closePaymentModal();
          }, 2000);
        },
        (error) => {
          // Call the failure callback
          if (onFailure) {
            onFailure(error);
          }
        },
        orderPreview,
      );
    } catch (err) {
      toast.error('Failed to initiate payment');
      console.error('Payment initiation error:', err);
    }
  };

  const handleModalClose = () => {
    if (!isLoading && !isProcessing) {
      setPaymentDetails(null);
      setOrderPreview(null);
      setIsPreparingOrder(false);
      resetPaymentState();
      closePaymentModal();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Close button */}
        {!isLoading && !isProcessing && (
          <button
            onClick={handleModalClose}
            className="absolute right-4 top-4 rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            ✕
          </button>
        )}

        {/* Content */}
        {!paymentDetails ? (
          <>
            {/* Payment Initiation */}
            <h2 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
              Complete Payment
            </h2>

            <div className="mb-6 space-y-4">
              <p className="text-slate-600">
                You will be redirected to Razorpay to complete the payment.
              </p>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Secure checkout: UPI, netbanking, and wallet methods are supported.
              </div>

              {/* User Info Display */}
              {user && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</p>
                  <p className="text-slate-900">
                    {displayName || 'Not provided'}
                  </p>

                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                  <p className="text-slate-900">{displayEmail || 'Not provided'}</p>

                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                  <p className="text-slate-900">
                    {displayPhone || 'Not provided'}
                  </p>
                </div>
              )}

              {orderPreview && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Payment Summary</p>
                  <p className="text-sm text-emerald-900">
                    <strong>Session:</strong> {sessionId}
                  </p>
                  <div className="rounded-lg border border-emerald-200 bg-white/80 p-3 space-y-1.5 text-sm text-emerald-900">
                    <div className="flex items-center justify-between">
                      <span>Session fee</span>
                      <strong>{formatCurrency(orderPreview.gross_amount, orderPreview.currency)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Platform charge</span>
                      <span>{formatCurrency(orderPreview.platform_charge, orderPreview.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Commission</span>
                      <span>{formatCurrency(orderPreview.commission_charge, orderPreview.currency)}</span>
                    </div>
                    <div className="h-px bg-emerald-200" />
                    <div className="flex items-center justify-between">
                      <span>Teacher payout</span>
                      <span>{formatCurrency(orderPreview.net_payout, orderPreview.currency)}</span>
                    </div>
                    <div className="h-px bg-emerald-200" />
                    <div className="flex items-center justify-between text-base">
                      <strong>Total payable</strong>
                      <strong>{formatCurrency(orderPreview.total_payable, orderPreview.currency)}</strong>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-900 break-all">
                    <strong>Order Ref:</strong> {orderPreview.gateway_order_id}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={orderPreview ? handlePaymentInitiation : handlePrepareOrder}
                disabled={isPreparingOrder || isLoading || isProcessing}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isPreparingOrder
                  ? 'Preparing...'
                  : isLoading
                    ? 'Opening...'
                    : orderPreview
                      ? 'Proceed to Razorpay'
                      : 'Review Payment'}
              </button>
              <button
                onClick={handleModalClose}
                disabled={isPreparingOrder || isLoading || isProcessing}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Payment Success */}
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <svg
                  className="h-16 w-16 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
                Payment Successful
              </h2>
              <p className="mb-4 text-slate-600">
                Your payment of ₹{paymentDetails.amount} has been processed.
              </p>

              <div className="mb-6 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <p className="text-sm text-slate-700">
                  <strong>Transaction ID:</strong>{' '}
                  <code className="text-xs text-slate-600">
                    {paymentDetails.transactionId.substring(0, 12)}...
                  </code>
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Payment ID:</strong>{' '}
                  <code className="text-xs text-slate-600">
                    {paymentDetails.paymentId.substring(0, 12)}...
                  </code>
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Time:</strong>{' '}
                  {new Date(paymentDetails.timestamp).toLocaleString()}
                </p>
              </div>

              <button
                onClick={handleModalClose}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
