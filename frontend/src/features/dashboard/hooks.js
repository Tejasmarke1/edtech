import { useState, useEffect, useCallback } from 'react';
import { getMySessions } from './api';
import { transformSessionsData } from './utils';

export const useMySessions = () => {
  const [data, setData] = useState({
    sessions: [],
    stats: {
      pendingCount: 0,
      upcomingCount: 0,
      totalSessions: 0,
      nextSession: null,
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMySessions();
      const sessions = Array.isArray(result)
        ? result
        : result?.items || result?.sessions || result?.data?.sessions || [];
      const stats = transformSessionsData(sessions);

      setData({
        sessions,
        stats
      });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions: data.sessions,
    stats: data.stats,
    isLoading,
    error,
    refetch: fetchSessions
  };
};
