import { useCallback, useEffect, useMemo, useState } from 'react';
import ratingsApi from './api';

const DISMISSED_KEY = 'dismissed_pending_ratings';

function readDismissedIds() {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(ids) {
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export function usePendingRatings(enabled) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPending = useCallback(async () => {
    if (!enabled) {
      setPending([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await ratingsApi.getPending();
      const dismissed = readDismissedIds();
      const filtered = (data || []).filter((item) => !dismissed.includes(item.session_id));
      setPending(filtered);
    } catch (err) {
      // Keep ratings prompts non-blocking if API is temporarily unavailable.
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError(err?.message || 'Unable to load pending ratings');
      }
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const current = useMemo(() => (pending.length ? pending[0] : null), [pending]);

  const dismissCurrent = useCallback(() => {
    setPending((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      const dismissed = readDismissedIds();
      if (!dismissed.includes(first.session_id)) {
        writeDismissedIds([...dismissed, first.session_id]);
      }
      return rest;
    });
  }, []);

  const removeCurrentAfterSubmit = useCallback(() => {
    setPending((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      const dismissed = readDismissedIds().filter((id) => id !== first.session_id);
      writeDismissedIds(dismissed);
      return rest;
    });
  }, []);

  return {
    pending,
    current,
    loading,
    error,
    loadPending,
    dismissCurrent,
    removeCurrentAfterSubmit,
  };
}

export function useSubmitRating() {
  const [submitting, setSubmitting] = useState(false);

  const submitRating = useCallback(async (payload) => {
    setSubmitting(true);
    try {
      return await ratingsApi.submit(payload);
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitting, submitRating };
}
