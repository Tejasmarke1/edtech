import React, { forwardRef } from 'react';

/**
 * Enhanced Input Component with comprehensive states (Section 0.2.2)
 * 
 * States: default, focus, hover, disabled, error, success, loading
 * Sizes: sm, md (default), lg
 * 
 * Features:
 * - Helper text and error messages
 * - Character counter for textareas
 * - Icon support (left/right)
 * - Loading state support
 * - Success/error indicators
 */
const Input = forwardRef(({
  label,
  error,
  success,
  helper,
  maxLength,
  showCharCount = false,
  disabled = false,
  loading = false,
  size = 'md',
  className = '',
  type = 'text',
  icon: Icon = null,
  iconRight = null,
  charCount = 0,
  ...props
}, ref) => {
  // Size mappings
  const sizes = {
    sm: 'px-3 py-1.5 text-body-sm h-9',
    md: 'px-4 py-2.5 text-body h-11', // 40-44px
    lg: 'px-4 py-3 text-body-lg h-12',
  };

  // Base input styles
  const baseInput = `w-full font-sans rounded-lg border-2 transition-all duration-standard placeholder:text-slate-400 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500`;

  // State-based styles
  let stateStyles = '';
  
  if (disabled) {
    stateStyles = 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600';
  } else if (error) {
    stateStyles = 'border-error bg-red-50 text-slate-900 focus:border-red-600 focus:ring-2 focus:ring-red-200 hover:border-red-300 dark:bg-red-900/20 dark:border-red-600 dark:focus:ring-red-500/30';
  } else if (success) {
    stateStyles = 'border-success bg-green-50 text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-green-200 hover:border-emerald-300 dark:bg-green-900/20 dark:border-success dark:focus:ring-green-500/30';
  } else {
    stateStyles = 'border-border-subtle bg-white text-slate-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:focus:border-primary-400 dark:focus:ring-primary-500/30 dark:hover:border-slate-600';
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-label font-semibold text-text-primary mb-2 dark:text-slate-200">
          {label}
          {props.required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      {/* Input wrapper for icon positioning */}
      <div className="relative">
        {/* Left Icon */}
        {Icon && !loading && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none dark:text-slate-600" />
        )}

        {/* Loading spinner */}
        {loading && (
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-600 animate-spin dark:text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}

        {/* Main input */}
        <input
          ref={ref}
          type={type}
          disabled={disabled || loading}
          maxLength={maxLength}
          className={`${baseInput} ${sizes[size]} ${stateStyles} ${Icon || loading ? 'pl-10' : ''} ${(iconRight || error || success || loading) ? 'pr-10' : ''} ${className}`}
          {...props}
        />

        {/* Right Icon - Error, Success, or Custom Icon */}
        {!loading && error && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-error pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        {!loading && success && !error && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-success pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        {!loading && iconRight && !error && !success && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {iconRight}
          </div>
        )}
      </div>

      {/* Helper text / Error message / Character counter */}
      <div className="mt-2 text-body-sm">
        {error && (
          <p className="text-error font-medium dark:text-red-400 flex items-center gap-1">
            <span aria-label="Error">⚠</span> {error}
          </p>
        )}
        {success && !error && (
          <p className="text-success font-medium dark:text-green-400 flex items-center gap-1">
            <span aria-label="Success">✓</span> {success}
          </p>
        )}
        {helper && !error && (
          <p className="text-slate-500 dark:text-slate-400">{helper}</p>
        )}
        {(maxLength && showCharCount) && (
          <p className="text-slate-500 dark:text-slate-400 text-right mt-1">
            {props.value?.length || charCount}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
