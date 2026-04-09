import React from 'react';

/**
 * Pagination Component for navigating through pages (Section 0.2.10)
 * 
 * Features:
 * - Page numbers with active state
 * - Previous/Next arrows
 * - Disabled state when at boundary
 * - Responsive condensed view on mobile
 * - "Page X of Y" display
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
  showPageInfo = true,
  maxVisiblePages = 5,
  className = '',
}) {
  if (totalPages <= 1) return null;

  // Calculate page numbers to display
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  // Adjust startPage if we're near the end
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className={`flex flex-col gap-4 items-center ${className}`}>
      {/* Page info */}
      {showPageInfo && (
        <p className="text-body-sm text-text-secondary dark:text-slate-400">
          Page {currentPage} of {totalPages}
        </p>
      )}

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border-2 border-border-subtle dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-standard"
          aria-label="Previous page"
          title="Previous"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Page numbers */}
        <div className="flex gap-1">
          {/* Show first page if not visible */}
          {startPage > 1 && (
            <>
              <PageButton
                page={1}
                isActive={currentPage === 1}
                onClick={() => onPageChange(1)}
              />
              {startPage > 2 && (
                <span className="px-3 py-2 text-text-secondary dark:text-slate-400">
                  ...
                </span>
              )}
            </>
          )}

          {/* Page numbers in range */}
          {pages.map((page) => (
            <PageButton
              key={page}
              page={page}
              isActive={currentPage === page}
              onClick={() => onPageChange(page)}
            />
          ))}

          {/* Show last page if not visible */}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <span className="px-3 py-2 text-text-secondary dark:text-slate-400">
                  ...
                </span>
              )}
              <PageButton
                page={totalPages}
                isActive={currentPage === totalPages}
                onClick={() => onPageChange(totalPages)}
              />
            </>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border-2 border-border-subtle dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-standard"
          aria-label="Next page"
          title="Next"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * PageButton - Individual page number button
 */
function PageButton({ page, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`min-w-11 h-11 px-3 rounded-lg font-semibold transition-all duration-standard ${
        isActive
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'bg-white dark:bg-slate-900 text-text-primary dark:text-slate-200 border-2 border-border-subtle dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      {page}
    </button>
  );
}

/**
 * Pagination with go-to-page input
 */
export function AdvancedPagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
  perPage = 20,
  totalItems = 100,
}) {
  const [inputPage, setInputPage] = React.useState(currentPage.toString());

  const handleGoToPage = (e) => {
    e.preventDefault();
    const page = parseInt(inputPage);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setInputPage(currentPage.toString());
    }
  };

  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* Results info */}
      <p className="text-body-sm text-text-secondary dark:text-slate-400">
        Showing {start}–{end} of {totalItems} results
      </p>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          showPageInfo={false}
        />

        {/* Go to page */}
        <form onSubmit={handleGoToPage} className="flex items-center gap-2">
          <label htmlFor="goto-page" className="text-body-sm text-text-secondary">
            Go to:
          </label>
          <input
            id="goto-page"
            type="number"
            min="1"
            max={totalPages}
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            className="w-16 px-3 py-1.5 border-2 border-border-subtle rounded-lg"
          />
        </form>
      </div>
    </div>
  );
}