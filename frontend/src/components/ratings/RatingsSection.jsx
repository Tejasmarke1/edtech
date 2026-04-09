import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tabs } from '../ui';
import ratingsApi from '../../features/ratings/ratingsApi';
import { toast } from 'react-hot-toast';

const PAGE_SIZE = 5;

function Stars({ value }) {
  return (
    <div className="flex gap-0.5 text-amber-400" aria-label={`${value} star rating`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </div>
  );
}

function RatingList({ items, emptyMessage }) {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setPage(0);
    setExpanded({});
  }, [items]);

  if (!items.length) {
    return <div className="py-8 text-slate-500 text-sm">{emptyMessage}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-3">
      {visibleItems.map((item) => (
        <div key={`${item.direction}-${item.session_id}-${item.created_at}`} className="rounded-xl border border-slate-200 p-4 bg-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Stars value={item.stars} />
                <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {item.direction}
                </span>
              </div>
              <div className="text-sm text-slate-600">
                Session: <span className="font-medium text-slate-900">{item.topic_description || item.session_id}</span>
              </div>
              <div className="text-sm text-slate-600">
                Counterpart: <span className="font-medium text-slate-900">{item.counterpart_user_name || 'N/A'}</span>
              </div>
              {item.review_text && (() => {
                const key = `${item.session_id}-${item.created_at}`;
                const isExpanded = Boolean(expanded[key]);
                const shouldTruncate = item.review_text.length > 200;
                const reviewText = shouldTruncate && !isExpanded
                  ? `${item.review_text.slice(0, 200)}...`
                  : item.review_text;

                return (
                  <div>
                    <p className="text-sm text-slate-700 leading-relaxed">{reviewText}</p>
                    {shouldTruncate && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isExpanded }))}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">
              {new Date(item.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      ))}

      <div className="pt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">Page {page + 1} of {totalPages}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RatingsSection({
  showGiven = true,
  showReceived = true,
  title = 'My Ratings',
  subtitle = 'Review ratings you have given and received across completed sessions.',
}) {
  const [history, setHistory] = useState({ given: [], received: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await ratingsApi.getHistory();
        setHistory({
          given: data?.given || [],
          received: data?.received || [],
        });
      } catch (error) {
        // Ratings endpoint may be unavailable in some environments; keep profile usable.
        setHistory({ given: [], received: [] });
        const status = error?.response?.status;
        if (status !== 404) {
          toast.error('Unable to load ratings history right now.');
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const tabs = useMemo(() => {
    const tabItems = [];
    if (showGiven) {
      tabItems.push({
        label: `Ratings Given (${history.given.length})`,
        content: loading ? (
          <div className="py-8 text-slate-500 text-sm">Loading ratings...</div>
        ) : (
          <RatingList items={history.given} emptyMessage="You haven't rated any sessions yet." />
        ),
      });
    }

    if (showReceived) {
      tabItems.push({
        label: `Ratings Received (${history.received.length})`,
        content: loading ? (
          <div className="py-8 text-slate-500 text-sm">Loading ratings...</div>
        ) : (
          <RatingList items={history.received} emptyMessage="No ratings received yet." />
        ),
      });
    }

    return tabItems;
  }, [history, loading, showGiven, showReceived]);

  return (
    <Card className="mt-6">
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {tabs.length > 0 ? (
        <Tabs tabs={tabs} />
      ) : (
        <div className="py-8 text-slate-500 text-sm">No ratings to display.</div>
      )}
    </Card>
  );
}
