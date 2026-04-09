import React, { forwardRef, useRef, useEffect, useState } from 'react';

/**
 * Select/Dropdown Component (Section 0.2.2)
 * 
 * Features:
 * - Custom styled dropdown arrow
 * - Chevron icon rotates on open
 * - Option hover state with highlight
 * - Selected option with checkmark
 * - Keyboard navigation support
 * - Touch-friendly 44px height
 */
const Select = forwardRef(({
  label,
  options = [],
  value,
  onChange = () => {},
  error,
  disabled = false,
  placeholder = 'Select an option...',
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Size mappings
  const sizes = {
    sm: 'px-3 py-1.5 text-body-sm h-9',
    md: 'px-4 py-2.5 text-body h-11',
    lg: 'px-4 py-3 text-body-lg h-12',
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && e.key === 'Enter') {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, options.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectOption(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelectOption = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-label font-semibold text-text-primary mb-2 dark:text-slate-200">
          {label}
          {props.required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      {/* Select button */}
      <div className="relative">
        <button
          ref={ref}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-full flex items-center justify-between ${sizes[size]} rounded-lg border-2 transition-all duration-standard text-left ${
            error
              ? 'border-error bg-red-50 dark:bg-red-900/20'
              : isOpen
              ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
              : 'border-border-subtle dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400'
          } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-500/30 ${className}`}
          {...props}
        >
          <span className={selectedOption ? 'text-text-primary dark:text-slate-50' : 'text-text-tertiary dark:text-slate-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <svg
            className={`h-5 w-5 text-slate-600 dark:text-slate-400 transition-transform duration-standard ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-900 border-2 border-border-subtle dark:border-slate-700 rounded-lg shadow-lg">
            <ul className="max-h-64 overflow-y-auto">
              {options.length === 0 ? (
                <li className="px-4 py-3 text-body-sm text-text-tertiary text-center">
                  No options available
                </li>
              ) : (
                options.map((option, index) => (
                  <li key={option.value}>
                    <button
                      onClick={() => handleSelectOption(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors duration-standard ${
                        value === option.value
                          ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200'
                          : highlightedIndex === index
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                      type="button"
                    >
                      <span className="text-body">{option.label}</span>
                      {value === option.value && (
                        <svg
                          className="h-5 w-5 text-primary-600 dark:text-primary-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-body-sm text-error font-medium dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;