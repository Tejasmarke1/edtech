import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui';
import { useNotifications } from '../features/notifications/hooks';
import { useAuthStore } from '../stores/authStore';

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

function notificationTargetPath(notificationType, role) {
  if (
    notificationType === 'session_request' ||
    notificationType === 'substitute_proposed' ||
    notificationType === 'session_accepted' ||
    notificationType === 'session_rejected' ||
    notificationType === 'session_completed' ||
    notificationType === 'rating_reminder'
  ) {
    return role === 'teacher' ? '/teacher-sessions' : '/my-sessions';
  }

  if (notificationType === 'payment_received' || notificationType === 'withdrawal_processed') {
    return role === 'teacher' ? '/teacher-wallet' : '/payments';
  }

  return '/notifications';
}

function notificationAction(notificationType) {
  if (notificationType === 'session_rejected') {
    return 'open-rejected-popup';
  }
  if (notificationType === 'substitute_proposed') {
    return 'open-substitute-popup';
  }
  if (notificationType === 'session_request') {
    return 'open-request-actions';
  }
  return null;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const {
    items,
    unreadCount,
    loading,
    markAsRead,
    markAllVisibleAsRead,
    loadPage,
  } = useNotifications({ limit: 10, autoRefreshMs: 30000 });

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);
  const unreadItems = useMemo(() => items.filter((item) => !item.is_read), [items]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      loadPage();
    }
  }, [open, loadPage]);

  const handleOpenNotification = async (notification) => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch {
        // Ignore read failures so navigation still works.
      }
    }
    setOpen(false);
    navigate(notificationTargetPath(notification.type, role), {
      state: {
        notificationContext: {
          id: notification.id,
          type: notification.type,
          referenceId: notification.reference_id,
          title: notification.title,
          message: notification.message,
        },
        action: notificationAction(notification.type),
      },
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        title="Notifications"
        aria-label="Open notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors relative"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <button
              onClick={markAllVisibleAsRead}
              disabled={!hasUnread}
              className="text-sm text-blue-600 disabled:text-slate-400"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading notifications...</div>
            ) : unreadItems.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No unread notifications.</div>
            ) : (
              unreadItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleOpenNotification(item)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                    item.is_read ? 'bg-white' : 'bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="text-sm text-slate-600 mt-0.5">{item.message}</div>
                      <div className="text-xs text-slate-400 mt-1">{relativeTime(item.created_at)}</div>
                    </div>
                    {!item.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 mt-2" />}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              View all notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
