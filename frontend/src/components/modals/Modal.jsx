import React, { useEffect, useRef } from 'react';

/**
 * Modal/Dialog Component with animations (Section 0.2.4)
 * 
 * Features:
 * - Entry: fade in + zoom from 95%
 * - Exit: fade out + zoom out
 * - Backdrop click to dismiss (optional)
 * - Escape key to dismiss (optional)
 * - Scrollable body if content exceeds 60vh
 */
export default function Modal({
  isOpen = false,
  onClose = () => {},
  onBackdropClick = true,
  onEscapeClick = true,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  closeButton = true,
}) {
  const modalRef = useRef(null);

  // Size mappings
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
    full: 'max-w-5xl',
  };

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !onEscapeClick) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onEscapeClick, onClose]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      // Move initial focus into the modal for keyboard and screen reader users.
      const focusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || modalRef.current)?.focus();
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleTabTrap = (e) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const nodes = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={() => onBackdropClick && onClose()}
        role="presentation"
      />

      {/* Modal container */}
      <div
        className={`relative z-10 w-full max-h-screen overflow-hidden flex flex-col animate-scale-up ${sizes[size]} mx-4 ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        ref={modalRef}
        tabIndex={-1}
      >
        {/* Modal card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
          {/* Header */}
          {(title || closeButton) && (
            <div className="flex items-center justify-between p-8 border-b-2 border-border-subtle dark:border-slate-700">
              {title && (
                <h2 className="text-h2 font-heading font-semibold text-text-primary dark:text-slate-50">
                  {title}
                </h2>
              )}
              {closeButton && (
                <button
                  onClick={onClose}
                  className="ml-auto p-2 text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors duration-standard"
                  aria-label="Close modal"
                >
                  <svg
                    className="h-6 w-6"
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
              )}
            </div>
          )}

          {/* Body - scrollable if content exceeds 60vh */}
          <div className="flex-1 overflow-y-auto p-8 text-text-primary dark:text-slate-200">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t-2 border-border-subtle dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmation Dialog - Common pattern for confirmations
 */
export function ConfirmationDialog({
  isOpen = false,
  onConfirm = () => {},
  onCancel = () => {},
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      onBackdropClick={!isLoading}
      onEscapeClick={!isLoading}
      title={title}
      size="sm"
    >
      <p className="text-body text-text-secondary dark:text-slate-300 mb-6">
        {message}
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg border-2 border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-standard disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${
            confirmVariant === 'danger'
              ? 'bg-error hover:bg-red-600'
              : 'bg-primary-600 hover:bg-primary-700'
          } transition-colors duration-standard disabled:opacity-50 inline-flex items-center gap-2`}
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Alert Dialog - Show important messages
 */
export function AlertDialog({
  isOpen = false,
  onClose = () => {},
  title = 'Alert',
  message = 'This is an alert',
  type = 'info', // 'info', 'success', 'warning', 'error'
  actionText = 'OK',
}) {
  const icons = {
    info: (
      <svg className="h-12 w-12 text-info" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    success: (
      <svg className="h-12 w-12 text-success" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg className="h-12 w-12 text-warning" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="h-12 w-12 text-error" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onBackdropClick={false}
      onEscapeClick={true}
      title={title}
      size="sm"
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4">{icons[type]}</div>
        <p className="text-body text-text-secondary dark:text-slate-300 mb-6">
          {message}
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-standard font-semibold"
        >
          {actionText}
        </button>
      </div>
    </Modal>
  );
}