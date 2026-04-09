import React from 'react';

/**
 * Badge Component for status, tags, and counts (Section 0.2.6)
 * 
 * Variants:
 * - solid: Full background color, white text
 * - outlined: Border only, text = border color
 * - soft: Light background (10% opacity), text = darker shade
 * 
 * Statuses:
 * - pending: Amber
 * - accepted: Green
 * - completed: Blue
 * - rejected: Red
 * - proposed: Orange
 * 
 * Sizes: xs, sm, md
 */
export default function Badge({
  children,
  variant = 'solid',
  status = null,
  color = 'primary',
  size = 'md',
  icon: Icon = null,
  className = '',
}) {
  // Size mappings
  const sizes = {
    xs: 'px-2 py-0.5 text-body-sm',
    sm: 'px-2.5 py-1 text-body-sm',
    md: 'px-3 py-1.5 text-body',
  };

  // Status to color mapping
  const statusColorMap = {
    pending: 'warning',
    accepted: 'success',
    completed: 'primary',
    rejected: 'error',
    proposed: 'warning',
  };

  const effectiveColor = status ? statusColorMap[status] : color;

  // Normalize colors used across pages to supported palette keys.
  const colorAliases = {
    blue: 'primary',
    green: 'success',
    red: 'error',
    amber: 'warning',
    yellow: 'warning',
    purple: 'primary',
    indigo: 'primary',
    slate: 'gray',
    gray: 'gray',
  };

  // Color-specific styles for each variant
  const colorStyles = {
    primary: {
      solid: 'bg-primary-600 text-white dark:bg-primary-500',
      outlined: 'border-2 border-primary-600 text-primary-600 bg-transparent dark:border-primary-400 dark:text-primary-400',
      soft: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    },
    success: {
      solid: 'bg-success text-white dark:bg-emerald-600',
      outlined: 'border-2 border-success text-success bg-transparent dark:border-emerald-500 dark:text-emerald-400',
      soft: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    warning: {
      solid: 'bg-warning text-white dark:bg-amber-600',
      outlined: 'border-2 border-warning text-warning bg-transparent dark:border-amber-500 dark:text-amber-400',
      soft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    error: {
      solid: 'bg-error text-white dark:bg-red-600',
      outlined: 'border-2 border-error text-error bg-transparent dark:border-red-500 dark:text-red-400',
      soft: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
    gray: {
      solid: 'bg-slate-600 text-white dark:bg-slate-500',
      outlined: 'border-2 border-slate-600 text-slate-600 bg-transparent dark:border-slate-400 dark:text-slate-400',
      soft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
  };

  const normalizedColor = colorAliases[effectiveColor] || effectiveColor;
  const resolvedColorStyles = colorStyles[normalizedColor] || colorStyles.primary;
  const resolvedVariant = resolvedColorStyles[variant] ? variant : 'solid';

  const baseStyles = `inline-flex items-center gap-1.5 rounded-full font-semibold transition-all duration-standard ${sizes[size]}`;

  return (
    <span
      className={`${baseStyles} ${resolvedColorStyles[resolvedVariant]} ${className}`}
      role="status"
    >
      {Icon && <Icon className={'h-4 w-4'} />}
      {children}
    </span>
  );
}

/**
 * BadgeGroup - Display multiple related badges
 */
export function BadgeGroup({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  );
}