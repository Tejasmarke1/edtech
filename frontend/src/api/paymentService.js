/**
 * Payment API Service
 * Handles all payment-related API calls with the backend
 */

import apiClient from './client';

/**
 * Create a payment order for a session
 * @param {string} sessionId - Session ID to create payment for
 * @returns {Promise<Object>} - Order details including order_id and amount
 */
export const createPaymentOrder = async (sessionId) => {
  try {
    const response = await apiClient.post(
      '/payments/orders',
      { session_id: sessionId },
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Failed to create payment order';
    throw new Error(message);
  }
};

/**
 * Verify payment with backend after Razorpay checkout
 * @param {Object} paymentData - { gateway_order_id, gateway_payment_id, signature }
 * @returns {Promise<Object>} - Verification result with payment status
 */
export const verifyPayment = async (paymentData) => {
  try {
    const response = await apiClient.post(
      '/payments/verify/razorpay',
      {
        gateway_order_id: paymentData.gateway_order_id,
        gateway_payment_id: paymentData.gateway_payment_id,
        signature: paymentData.signature,
      },
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Payment verification failed';
    throw new Error(message);
  }
};

/**
 * Get payment transaction details
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} - Transaction details
 */
export const getTransaction = async (transactionId) => {
  try {
    const response = await apiClient.get(
      `/payments/transactions/${transactionId}`,
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Failed to fetch transaction';
    throw new Error(message);
  }
};

/**
 * Get list of payment transactions with pagination
 * @param {Object} options - { skip, limit }
 * @returns {Promise<Object>} - Paginated transaction list
 */
export const listTransactions = async (options = {}) => {
  try {
    const { skip = 0, limit = 20 } = options;
    const response = await apiClient.get('/payments/transactions', {
      params: {
        skip,
        limit,
      },
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Failed to fetch transactions';
    throw new Error(message);
  }
};

/**
 * Get monthly earnings for a user (teacher)
 * @param {number} year - Year (e.g., 2024)
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} - Monthly earnings breakdown
 */
export const getMonthlyEarnings = async (year, month) => {
  try {
    const response = await apiClient.get('/payments/earnings/monthly', {
      params: { year, month },
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Failed to fetch earnings';
    throw new Error(message);
  }
};

/**
 * Process a withdrawal request (admin/teacher)
 * @param {Object} payload - { withdrawal_id, success }
 * @returns {Promise<Object>} - Withdrawal processing result
 */
export const processWithdrawal = async (payload) => {
  try {
    const response = await apiClient.post(
      '/payments/withdrawals/process',
      payload,
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Failed to process withdrawal';
    throw new Error(message);
  }
};

/**
 * Get last payment transaction for a session (for resume payment)
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} - Last transaction or null
 */
export const getLastSessionTransaction = async (sessionId) => {
  try {
    const response = await apiClient.get('/payments/transactions', {
      params: { limit: 1 },
    });
    // Filter for the specific session
    const transactions = response.data.items || response.data;
    return transactions.find((tx) => tx.session_id === sessionId) || null;
  } catch (error) {
    console.error('Failed to fetch last transaction:', error);
    return null;
  }
};
