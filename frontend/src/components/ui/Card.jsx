import React from 'react';

/**
 * Enhanced Card Component with multiple variants (Section 0.2.3)
 * 
 * Variants:
 * - default: White bg, border, shadow-sm
 * - elevated: White bg, no border, shadow-md
 * - outlined: Transparent/light bg, bold border
 * - gradient: Gradient background, white text
 * - interactive: Hoverable, elevates on hover
 * 
 * Sections: header, body, footer, image can be combined
 */
export default function Card({
  children,
  className = '',
  variant = 'default',
  hoverable = false,
  interactive = false,
}) {
  // Variant styles
  const variants = {
    default: 'bg-white dark:bg-slate-900 border-2 border-border-subtle dark:border-slate-700 shadow-sm rounded-xl',
    elevated: 'bg-white dark:bg-slate-900 border-0 shadow-md rounded-xl',
    outlined: 'bg-transparent dark:bg-transparent border-2 border-primary-600 dark:border-primary-400 rounded-xl',
    gradient: 'bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-700 dark:to-primary-900 text-white rounded-xl shadow-lg',
    interactive: 'bg-white dark:bg-slate-900 border-2 border-border-subtle dark:border-slate-700 shadow-sm rounded-xl cursor-pointer',
  };

  // Hover states
  const hoverClass = (interactive || hoverable)
    ? 'hover:shadow-md hover:translate-y-[-2px] transition-all duration-standard'
    : '';

  return (
    <div
      className={`${variants[variant]} ${hoverClass} p-6 ${className}`}
      role={interactive ? 'button' : undefined}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader - Header section with optional border
 */
export function CardHeader({ children, className = '', withBorder = true }) {
  return (
    <div
      className={`${withBorder ? 'pb-4 border-b-2 border-border-subtle dark:border-slate-700' : ''} mb-4 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * CardBody - Main content section
 */
export function CardBody({ children, className = '' }) {
  return (
    <div className={`py-2 ${className}`}>
      {children}
    </div>
  );
}

/**
 * CardFooter - Footer section for actions
 */
export function CardFooter({ children, className = '' }) {
  return (
    <div
      className={`pt-4 border-t-2 border-border-subtle dark:border-slate-700 flex justify-end gap-3 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * CardImage - Image section that spans full width without padding
 */
export function CardImage({ src, alt = '', className = '' }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-48 object-cover rounded-lg -m-6 mb-4 ${className}`}
    />
  );
}
