import React, { useState } from 'react';

/**
 * Tabs Component for content organization (Section 0.2.5)
 * 
 * Features:
 * - Horizontal tab labels
 * - Active tab underline
 * - Smooth content fade-in
 * - Responsive: scroll on mobile, optional collapse
 */
export default function Tabs({
  tabs = [],
  defaultTabIndex = 0,
  onTabChange = () => {},
  className = '',
}) {
  const [activeIndex, setActiveIndex] = useState(defaultTabIndex);

  const handleTabClick = (index) => {
    setActiveIndex(index);
    onTabChange(index);
  };

  if (!tabs.length) return null;

  return (
    <div className={`w-full ${className}`}>
      {/* Tab labels */}
      <div className="border-b-2 border-border-subtle dark:border-slate-700 flex gap-0 overflow-x-auto">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabClick(index)}
            className={`px-6 py-4 text-label font-semibold whitespace-nowrap transition-all duration-standard ${
              activeIndex === index
                ? 'text-primary-600 dark:text-primary-400 border-b-3 border-primary-600 dark:border-primary-400'
                : 'text-text-secondary dark:text-slate-400 hover:text-text-primary dark:hover:text-slate-300'
            }`}
            role="tab"
            aria-selected={activeIndex === index}
            aria-controls={`tab-${index}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-6 animate-fade-in">
        {tabs[activeIndex]?.content}
      </div>
    </div>
  );
}

/**
 * Tab Component for composable tabs
 */
export function Tab({ label, content, disabled = false }) {
  return { label, content, disabled };
}

/**
 * Simple Tabs - for use with Tabs.Tab pattern
 */
export function SimpleTabs({
  children,
  defaultLabel,
  onTabChange = () => {},
}) {
  const tabs = React.Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(
    defaultLabel
      ? tabs.findIndex((tab) => tab.props.label === defaultLabel)
      : 0
  );

  const handleTabClick = (index) => {
    setActiveIndex(index);
    onTabChange(index);
  };

  if (!tabs.length) return null;

  return (
    <div className="w-full">
      {/* Tab labels */}
      <div className="border-b-2 border-border-subtle dark:border-slate-700 flex gap-0 overflow-x-auto">
        {tabs.map((tab, index) => {
          const { label, disabled } = tab.props;
          return (
            <button
              key={index}
              onClick={() => !disabled && handleTabClick(index)}
              disabled={disabled}
              className={`px-6 py-4 text-label font-semibold whitespace-nowrap transition-all duration-standard ${
                disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : activeIndex === index
                  ? 'text-primary-600 dark:text-primary-400 border-b-3 border-primary-600 dark:border-primary-400'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text-primary dark:hover:text-slate-300'
              }`}
              role="tab"
              aria-selected={activeIndex === index}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="py-6 animate-fade-in">{tabs[activeIndex]?.props.children}</div>
    </div>
  );
}