import React, { forwardRef } from 'react';

/**
 * Checkbox Component with animations (Section 0.2.2)
 * 
 * Features:
 * - 24px × 24px hit area (touch-friendly)
 * - Custom styled (not browser default)
 * - Animated checkmark on check
 * - Focus state with ring
 * - Label clickable via htmlFor
 */
const Checkbox = forwardRef(({
  label,
  id,
  checked = false,
  disabled = false,
  onChange = () => {},
  error,
  className = '',
  ...props
}, ref) => {
  const baseCheckbox = `flex-shrink-0 h-6 w-6 rounded-lg border-2 transition-all duration-standard cursor-pointer flex items-center justify-center`;

  const checkboxClasses = disabled
    ? 'border-slate-300 bg-slate-100 cursor-not-allowed opacity-50 dark:border-slate-600 dark:bg-slate-800'
    : checked
    ? 'border-primary-600 bg-primary-600 dark:border-primary-500 dark:bg-primary-500'
    : 'border-border-subtle dark:border-slate-600 hover:border-primary-600 dark:hover:border-primary-500';

  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center h-6">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        <label
          htmlFor={id}
          className={`${baseCheckbox} ${checkboxClasses} focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${className}`}
        >
          {checked && (
            <svg
              className="h-4 w-4 text-white animate-scale-up"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
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

Checkbox.displayName = 'Checkbox';
export default Checkbox;

/**
 * CheckboxGroup - Multiple checkboxes
 */
export function CheckboxGroup({
  options = [],
  value = [],
  onChange = () => {},
  error,
  disabled = false,
  label,
}) {
  const handleChange = (optionValue) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <label className="text-label font-semibold text-text-primary dark:text-slate-200">
          {label}
        </label>
      )}
      {options.map((option) => (
        <Checkbox
          key={option.value}
          id={`checkbox-${option.value}`}
          label={option.label}
          checked={value.includes(option.value)}
          onChange={() => handleChange(option.value)}
          disabled={disabled || option.disabled}
        />
      ))}
      {error && (
        <p className="text-body-sm text-error dark:text-red-400">{error}</p>
      )}
    </div>
  );
}