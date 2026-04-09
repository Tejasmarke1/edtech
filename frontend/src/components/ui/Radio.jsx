import React, { forwardRef } from 'react';

/**
 * Radio Component with animations (Section 0.2.2)
 * 
 * Features:
 * - 24px × 24px hit area (touch-friendly)
 * - Custom styled animated circle
 * - Animated dot appears on select
 * - Focus state with ring
 * - Label clickable via htmlFor
 */
const Radio = forwardRef(({
  label,
  id,
  value,
  checked = false,
  disabled = false,
  onChange = () => {},
  name,
  error,
  className = '',
  ...props
}, ref) => {
  const baseRadio = `flex-shrink-0 h-6 w-6 rounded-full border-2 transition-all duration-standard cursor-pointer flex items-center justify-center`;

  const radioClasses = disabled
    ? 'border-slate-300 bg-slate-100 cursor-not-allowed opacity-50 dark:border-slate-600 dark:bg-slate-800'
    : checked
    ? 'border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/30'
    : 'border-border-subtle dark:border-slate-600 hover:border-primary-600 dark:hover:border-primary-500';

  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center h-6">
        <input
          ref={ref}
          id={id}
          type="radio"
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          name={name}
          className="sr-only"
          {...props}
        />
        <label
          htmlFor={id}
          className={`${baseRadio} ${radioClasses} focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${className}`}
        >
          {checked && (
            <div className="h-3 w-3 rounded-full bg-primary-600 dark:bg-primary-500 animate-scale-up" />
          )}
        </label>
      </div>
      {label && (
        <label htmlFor={id} className="flex flex-col gap-1 cursor-pointer">
          <span className="text-body font-medium text-text-primary dark:text-slate-200">
            {label}
          </span>
          {error && (
            <span className="text-body-sm text-error dark:text-red-400">{error}</span>
          )}
        </label>
      )}
    </div>
  );
});

Radio.displayName = 'Radio';
export default Radio;

/**
 * RadioGroup - Multiple radio buttons
 */
export function RadioGroup({
  options = [],
  value,
  onChange = () => {},
  error,
  disabled = false,
  label,
  name,
}) {
  return (
    <div className="flex flex-col gap-3">
      {label && (
        <label className="text-label font-semibold text-text-primary dark:text-slate-200">
          {label}
        </label>
      )}
      {options.map((option) => (
        <Radio
          key={option.value}
          id={`radio-${name}-${option.value}`}
          name={name}
          value={option.value}
          label={option.label}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          disabled={disabled || option.disabled}
        />
      ))}
      {error && (
        <p className="text-body-sm text-error dark:text-red-400">{error}</p>
      )}
    </div>
  );
}