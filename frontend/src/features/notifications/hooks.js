import { useCallback, useEffect, useMemo, useState } from 'react';
import notificationsApi from './api';

export function useNotifications({ limit = 10, autoRefreshMs = 30000 } = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const skip = useMemo(() => page * limit, [page, limit]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await notificationsApi.getUnreadCount();
      setUnreadCount(data?.count || 0);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch unread count');
      setUnreadCount(0);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.list({ skip, limit });
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setError(null);
      await refreshUnreadCount();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load notifications');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [skip, limit, refreshUnreadCount]);

  const markAsRead = useCallback(
    async (notificationId) => {
      try {
        await notificationsApi.markAsRead(notificationId);
        setItems((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setError(null);
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to mark notification as read');
      }
    },
    []
  );

  const markAllVisibleAsRead = useCallback(async () => {
    const unreadVisible = items.filter((n) => !n.is_read);
    if (!unreadVisible.length) return;
    try {
      await Promise.all(unreadVisible.map((n) => notificationsApi.markAsRead(n.id)));
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await refreshUnreadCount();
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to mark all notifications as read');
    }
  }, [items, refreshUnreadCount]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) return;
    const timer = setInterval(() => {
      refreshUnreadCount();
    }, autoRefreshMs);
    return () => clearInterval(timer);
  }, [autoRefreshMs, refreshUnreadCount]);

  return {
    items,
    total,
    unreadCount,
    loading,
    error,
    page,
    setPage,
    limit,
    loadPage,
    refreshUnreadCount,
    markAsRead,
    markAllVisibleAsRead,
  };
}
