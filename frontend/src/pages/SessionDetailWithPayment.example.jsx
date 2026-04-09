/**
 * Example: Session Detail Component with Payment Integration
 * This file demonstrates how to integrate Razorpay payment into your session detail page
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePaymentStore } from '../stores/paymentStore';
import { useAuthStore } from '../stores/authStore';
import { getSession, enrollSession } from '../api/sessionService';
import { getTransaction } from '../api/paymentService';

/**
 * Session Detail Page with Payment
 * Shows session info and initiates payment flow
 */
function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  
  const user = useAuthStore((state) => state.user);
  const openPaymentModal = usePaymentStore((state) => state.openPaymentModal);

  // Load session details
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setLoading(true);
        const data = await getSession(sessionId);
        setSession(data);
        setError(null);
      } catch (err) {
        setError('Failed to load session details');
        toast.error('Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId && user) {
      fetchSession();
    }
  }, [sessionId, user]);

  /**
   * Handle payment click
   * Opens the payment modal with success/failure callbacks
   */
  const handlePaymentClick = () => {
    if (!session || !user) {
      toast.error('Missing session or user information');
      return;
    }

    openPaymentModal(
      session.id,
      // Success callback
      (paymentData) => {
        setPaymentStatus({
          status: 'success',
          transactionId: paymentData.transactionId,
          amount: paymentData.amount,
          timestamp: paymentData.timestamp,
        });

        // Refresh session to show updated payment status
        setTimeout(() => {
          navigate(`/sessions/${sessionId}?payment=success`);
        }, 2000);
      },
      // Failure callback
      (error) => {
        setPaymentStatus({
          status: 'failed',
          error: error.message,
        });
      },
    );
  };

  /**
   * Resume incomplete payment
   * Called when user had started but didn't complete payment
   */
  const handleResumePayment = () => {
    handlePaymentClick();
  };

  /**
   * Check if payment is already completed for this session
   */
  const isPaymentCompleted =
    session?.payment_status === 'captured' ||
    session?.enrolled === true;

  /**
   * Check if payment is pending (created but not captured)
   */
  const isPaymentPending =
    session?.payment_status === 'created' ||
    session?.payment_status === 'authorized';

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-red-800">{error}</h2>
          <button
            onClick={() => navigate('/sessions')}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Session not found
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Session Header */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-start justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            {session.subject_name}
          </h1>
          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              session.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : session.status === 'accepted'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {session.status}
          </span>
        </div>

        {/* Session Details Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-gray-600">Teacher</p>
            <p className="font-semibold text-gray-900">{session.teacher_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Date & Time</p>
            <p className="font-semibold text-gray-900">
              {new Date(session.session_start_time).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Duration</p>
            <p className="font-semibold text-gray-900">
              {session.session_duration || '30'} minutes
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Session Type</p>
            <p className="font-semibold text-gray-900">
              {session.session_type === 'individual'
                ? '1-on-1'
                : 'Group'}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Section */}
      {!isPaymentCompleted && (
        <div className="mb-8 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Payment Required
          </h2>

          {isPaymentPending && (
            <div className="mb-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
              ⚠️ You have an incomplete payment. You can resume it or create a new one.
            </div>
          )}

          {/* Price Breakdown */}
          <div className="mb-6 space-y-2 rounded bg-white p-4">
            <div className="flex justify-between">
              <span className="text-gray-700">Session Fee:</span>
              <span className="font-semibold text-gray-900">
                ₹{session.gross_amount || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-700">Platform Charge:</span>
              <span className="text-gray-900">
                ₹{session.platform_charge || 0}
              </span>
            </div>
            <div className="flex justify-between border-t border-b py-2 text-lg font-bold">
              <span>Total Payable:</span>
              <span className="text-blue-600">
                ₹{(session.gross_amount || 0) + (session.platform_charge || 0)}
              </span>
            </div>
          </div>

          {/* Commission Info (if applicable) */}
          {session.commission_charge > 0 && (
            <p className="mb-4 text-xs text-gray-600">
              * Commission of ₹{session.commission_charge} will be deducted from teacher's earnings
            </p>
          )}

          {/* Payment Status Display */}
          {paymentStatus && (
            <div
              className={`mb-4 rounded p-4 ${
                paymentStatus.status === 'success'
                  ? 'bg-green-50'
                  : 'bg-red-50'
              }`}
            >
              {paymentStatus.status === 'success' ? (
                <>
                  <p className="font-semibold text-green-800">
                    ✓ Payment Successful!
                  </p>
                  <p className="text-sm text-green-700">
                    Transaction ID: {paymentStatus.transactionId}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-red-800">
                    ✗ Payment Failed
                  </p>
                  <p className="text-sm text-red-700">
                    {paymentStatus.error}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {isPaymentPending ? (
              <>
                <button
                  onClick={handleResumePayment}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Resume Payment
                </button>
                <button
                  onClick={handlePaymentClick}
                  className="flex-1 rounded-lg border-2 border-blue-600 px-4 py-3 font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Create New Order
                </button>
              </>
            ) : (
              <button
                onClick={handlePaymentClick}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Pay Now with Razorpay
              </button>
            )}
          </div>
        </div>
      )}

      {/* Payment Success Card */}
      {isPaymentCompleted && (
        <div className="mb-8 rounded-lg border-2 border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-3">
            <svg
              className="h-6 w-6 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-green-800">
                Payment Completed
              </h3>
              <p className="text-sm text-green-700">
                You are enrolled for this session. You can now join the session.
              </p>
            </div>
          </div>

          {session.meeting_link && (
            <div className="mt-4">
              <a
                href={session.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
              >
                Join Session →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Session Description */}
      {session.description && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            Description
          </h3>
          <p className="text-gray-700">{session.description}</p>
        </div>
      )}

      {/* Teacher Info */}
      {session.teacher_info && (
        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            About the Teacher
          </h3>
          <p className="text-gray-700">{session.teacher_info}</p>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => navigate('/sessions')}
        className="mt-8 text-blue-600 underline hover:text-blue-700"
      >
        ← Back to Sessions
      </button>
    </div>
  );
}

export default SessionDetailPage;
