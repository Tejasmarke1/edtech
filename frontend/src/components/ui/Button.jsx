import React from 'react';

/**
 * Enhanced Button Component with multiple variants and states (Section 0.2.1)
 * 
 * Variants:
 * - primary: Solid brand color (CTA), white/light text
 * - secondary: Outlined, brand border and text
 * - danger: Red background, white text
 * - success: Green background, white text
 * - ghost: Transparent, text only
 * 
 * Sizes: xs, sm, md (default), lg, xl
 * 
 * States: default, hover, active/pressed, disabled, loading
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon = null,
  iconOnly = false,
  ...props
}) {
  // Base styles - common to all buttons
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-standard focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed will-animate";

  // Size variants (0.2.1 - Default 44px height for touch-friendly)
  const sizes = {
    xs: 'px-2 py-1 text-body-sm h-8',
    sm: 'px-3 py-1.5 text-body-sm h-9',
    md: 'px-4 py-2.5 text-body h-11', // 44px
    lg: 'px-6 py-3 text-body-lg h-12',
    xl: 'px-8 py-4 text-button h-14',
  };

  // Icon-only sizes
  const iconSizes = {
    xs: 'p-1 h-8 w-8',
    sm: 'p-1.5 h-9 w-9',
    md: 'p-2.5 h-11 w-11', // 44px
    lg: 'p-3 h-12 w-12',
    xl: 'p-4 h-14 w-14',
  };

  // Variant styles
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-primary hover:shadow-md focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600',
    secondary: 'bg-white text-primary-600 border-2 border-primary-600 hover:bg-primary-50 active:bg-primary-100 shadow-sm focus:ring-primary-500 dark:bg-slate-900 dark:text-primary-400 dark:border-primary-400 dark:hover:bg-slate-800',
    outline: 'bg-transparent text-slate-700 border-2 border-slate-300 hover:bg-slate-50 active:bg-slate-100 hover:shadow-sm focus:ring-slate-500 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800',
    outlined: 'bg-transparent text-slate-700 border-2 border-slate-300 hover:bg-slate-50 active:bg-slate-100 hover:shadow-sm focus:ring-slate-500 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800',
    danger: 'bg-error text-white hover:bg-red-600 active:bg-red-700 shadow-error hover:shadow-md focus:ring-red-500 dark:hover:bg-red-500',
    success: 'bg-success text-white hover:bg-emerald-600 active:bg-emerald-700 shadow-green-500/20 hover:shadow-md focus:ring-emerald-500 dark:hover:bg-emerald-500',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 hover:shadow-none focus:ring-slate-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:active:bg-slate-700',
    'ghost-primary': 'bg-transparent text-primary-600 hover:bg-primary-50 active:bg-primary-100 hover:shadow-none focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-900/20',
  };

  // Disabled state
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  // Loading spinner class
  const loadingSpinner = loading ? (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ) : null;

  const buttonContent = (
    <>
      {(Icon || loading) && (loadingSpinner || <Icon className="h-5 w-5" />)}
      {!iconOnly && children}
    </>
  );

  const finalSize = iconOnly ? iconSizes[size] : sizes[size];
  const finalClassName = `${base} ${variants[variant]} ${finalSize} ${disabledClasses} ${className}`;

  return (
    <button
      className={finalClassName}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {buttonContent}
    </button>
  );
}
