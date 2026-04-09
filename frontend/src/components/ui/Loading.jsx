import React from 'react';

/**
 * Skeleton Loading Component with shimmer effect (Section 0.2.9)
 * Shows placeholder while content is loading
 */
export function Skeleton({
  className = '',
  variant = 'text',
  count = 1,
  width = '100%',
  height = '16px',
}) {
  const baseStyles = 'animate-shimmer bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded';

  const variants = {
    text: `${baseStyles} h-4 w-full mb-2 rounded`,
    circle: `${baseStyles} rounded-full`,
    rect: `${baseStyles}`,
    avatar: `${baseStyles} w-12 h-12 rounded-full`,
    card: `${baseStyles} w-full h-48 rounded-lg`,
  };

  if (count > 1 && variant === 'text') {
    return (
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer h-4 w-full mb-2 rounded'}
            style={{
              width: i === count - 1 ? '80%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${variants[variant]} ${className}`}
      style={{ width, height: variant !== 'text' ? height : 'auto' }}
    />
  );
}

/**
 * Card Skeleton - Common loading state for cards
 */
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4 ${className}`}>
      <Skeleton variant="rect" height="32px" className="w-3/4" />
      <div className="space-y-3">
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="90%" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="rect" height="40px" className="w-1/4" />
        <Skeleton variant="rect" height="40px" className="w-1/4" />
      </div>
    </div>
  );
}

/**
 * List Skeleton - Common loading state for lists
 */
export function ListSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Avatar Skeleton
 */
export function AvatarSkeleton({ size = 'md', className = '' }) {
  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Skeleton
      variant="circle"
      height={sizes[size].split(' ')[1]}
      width={sizes[size].split(' ')[0]}
      className={className}
    />
  );
}

/**
 * Spinner Component for smaller operations (Section 0.5.1)
 */
export function Spinner({
  size = 'md',
  variant = 'primary',
  className = '',
}) {
  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const colors = {
    primary: 'text-primary-600 dark:text-primary-400',
    white: 'text-white',
    gray: 'text-slate-600 dark:text-slate-400',
  };

  return (
    <svg
      className={`animate-spin ${sizes[size]} ${colors[variant]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

/**
 * ProgressBar Component for multi-step processes (Section 0.5.1)
 */
export function ProgressBar({
  progress = 0,
  showLabel = true,
  variant = 'primary',
  striped = false,
  animated = false,
  className = '',
}) {
  const variants = {
    primary: 'bg-primary-600 dark:bg-primary-500',
    success: 'bg-success dark:bg-emerald-500',
    warning: 'bg-warning dark:bg-amber-500',
    error: 'bg-error dark:bg-red-500',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-label font-semibold text-text-primary dark:text-slate-200">
            Loading
          </span>
          <span className="text-label text-text-secondary dark:text-slate-400">
            {Math.round(progress)}%
          </span>
        </div>
      )}
      <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-standard ${variants[variant]} ${
            animated ? 'animate-pulse' : ''
          } ${striped ? 'bg-gradient-to-r from-transparent to-transparent bg-[length:20px_100%]' : ''}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * LoadingOverlay - Full screen or container loading state
 */
export function LoadingOverlay({
  isVisible = true,
  fullScreen = false,
  message = 'Loading...',
}) {
  if (!isVisible) return null;

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0 z-10';

  return (
    <div
      className={`${containerClass} flex flex-col items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm`}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        {message && (
          <p className="text-label font-semibold text-slate-700 dark:text-slate-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}