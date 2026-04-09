import React, { useMemo, useState } from 'react';
import { Card, Button } from '../components/ui';
import { useNotifications } from '../features/notifications/hooks';

function relativeTime(isoTime) {
  const d = new Date(isoTime);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_OPTIONS = [
  'all',
  'session_request',
  'session_accepted',
  'session_rejected',
  'session_completed',
  'substitute_proposed',
  'rating_reminder',
  'payment_received',
  'withdrawal_processed',
  'general',
];

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const {
    items,
    total,
    unreadCount,
    loading,
    error,
    page,
    setPage,
    limit,
    markAsRead,
    markAllVisibleAsRead,
  } = useNotifications({ limit: 10, autoRefreshMs: 30000 });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const typeOk = typeFilter === 'all' || item.type === typeFilter;
      const readOk =
        readFilter === 'all' ||
        (readFilter === 'read' && item.is_read) ||
        (readFilter === 'unread' && !item.is_read);
      return typeOk && readOk;
    });
  }, [items, typeFilter, readFilter]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-2">Unread: {unreadCount}</p>
        </div>
        <Button variant="outline" onClick={markAllVisibleAsRead} disabled={!unreadCount}>
          Mark visible unread as read
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All types' : type}
              </option>
            ))}
          </select>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </Card>

      <Card>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-8 text-slate-500">Loading notifications...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-slate-500">No notifications found for selected filters.</div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className={`border rounded-xl p-4 ${item.is_read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/30'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600 mt-1">{item.message}</div>
                    <div className="text-xs text-slate-400 mt-2">{relativeTime(item.created_at)} • {item.type}</div>
                  </div>
                  {!item.is_read ? (
                    <Button variant="outline" onClick={() => markAsRead(item.id)}>
                      Mark read
                    </Button>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">Read</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-slate-500">
            Page {page + 1} of {totalPages} ({total} total records)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 0 || loading}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
