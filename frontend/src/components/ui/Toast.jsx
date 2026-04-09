/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import toast from 'react-hot-toast';

/**
 * Toast/Alert Components for notifications (Section 0.2.8)
 * Uses react-hot-toast under the hood
 * 
 * Features:
 * - Auto-dismiss: Success/Info 3-4s, Error/Warning 5-6s or require dismiss
 * - Manual close button always available
 * - Animations: Enter slide-in from bottom-right, exit slide-out
 * - Stacking: Multiple toasts stack vertically
 * - Responsive: Full width on mobile (90vw, max 450px)
 */

/**
 * Show success toast
 */
export const showSuccessToast = (message, options = {}) => {
  return toast.success(message, {
    duration: 4000,
    position: 'bottom-right',
    ...options,
  });
};

/**
 * Show error toast
 */
export const showErrorToast = (message, options = {}) => {
  return toast.error(message, {
    duration: 5000,
    position: 'bottom-right',
    ...options,
  });
};

/**
 * Show warning toast
 */
export const showWarningToast = (message, options = {}) => {
  return toast('⚠️ ' + message, {
    duration: 5000,
    position: 'bottom-right',
    style: {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
    },
    ...options,
  });
};

/**
 * Show info toast
 */
export const showInfoToast = (message, options = {}) => {
  return toast('ℹ️ ' + message, {
    duration: 4000,
    position: 'bottom-right',
    style: {
      background: '#dbeafe',
      color: '#1e40af',
      border: '1px solid #bfdbfe',
    },
    ...options,
  });
};

/**
 * Show loading toast (no auto-dismiss)
 */
export const showLoadingToast = (message) => {
  return toast.loading(message, {
    position: 'bottom-right',
  });
};

/**
 * Custom Toast Component - for more control
 */
export function Toast({
  type = 'info', // 'success', 'error', 'warning', 'info'
  title,
  message,
  onClose,
  autoClose = true,
  duration = 4000,
}) {
  const typeStyles = {
    success: {
      bg: 'bg-success',
      border: 'border-emerald-300',
      icon: '✓',
      textColor: 'text-white',
    },
    error: {
      bg: 'bg-error',
      border: 'border-red-300',
      icon: '✕',
      textColor: 'text-white',
    },
    warning: {
      bg: 'bg-warning',
      border: 'border-amber-300',
      icon: '⚠',
      textColor: 'text-white',
    },
    info: {
      bg: 'bg-info',
      border: 'border-blue-300',
      icon: 'ℹ',
      textColor: 'text-white',
    },
  };

  const style = typeStyles[type];

  React.useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div
      className={`${style.bg} ${style.textColor} px-6 py-4 rounded-lg shadow-lg border-2 ${style.border} flex gap-4 items-start min-w-80 max-w-96 animate-slide-in-right`}
      role="alert"
    >
      <span className="text-xl font-bold">{style.icon}</span>
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        {message && <p className="text-sm opacity-90">{message}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors duration-standard"
        aria-label="Close notification"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Toast Provider wrapper - add this to your app root
 * This enables the toast notification system
 */
export { Toaster } from 'react-hot-toast';