/**
 * Payment Store
 * Zustand store for managing payment modal state and callbacks
 */

import { create } from 'zustand';

export const usePaymentStore = create((set) => ({
  // State
  isOpen: false,
  sessionId: null,
  onSuccess: null,
  onFailure: null,

  // Actions
  /**
   * Open payment modal for a session
   * @param {string} sessionId - The session ID to pay for
   * @param {Function} onSuccess - Callback function on successful payment
   * @param {Function} onFailure - Callback function on failed payment
   */
  openPaymentModal: (sessionId, onSuccess, onFailure) =>
    set({
      isOpen: true,
      sessionId,
      onSuccess,
      onFailure,
    }),

  /**
   * Close payment modal and reset state
   */
  closePaymentModal: () =>
    set({
      isOpen: false,
      sessionId: null,
      onSuccess: null,
      onFailure: null,
    }),
}));
