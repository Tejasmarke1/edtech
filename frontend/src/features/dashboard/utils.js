import dayjs from 'dayjs';

function parseSessionDateTime(session) {
  const dateValue = session?.session_date || session?.date;
  const startTime = session?.slot_start_time || session?.start_time;

  if (dateValue && startTime) {
    const dt = dayjs(`${dateValue}T${startTime}`);
    if (dt.isValid()) return dt;
  }

  const fallback = dayjs(session?.startTime || session?.created_at || session?.updated_at);
  return fallback.isValid() ? fallback : dayjs.invalid();
}

export const transformSessionsData = (sessions = []) => {
  const now = dayjs();
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  let pendingCount = 0;
  let upcomingCount = 0;
  let totalSessions = safeSessions.length;
  let nextSession = null;
  let upcomingSessions = [];

  safeSessions.forEach((session) => {
    const status = String(session.status || '').toLowerCase();
    if (status === 'pending' || status === 'requested' || status === 'open') {
      pendingCount++;
    }

    const sessionDate = parseSessionDateTime(session);
    if (!sessionDate.isValid()) return;

    if (status === 'accepted' && sessionDate.isAfter(now)) {
      upcomingCount++;
      upcomingSessions.push(session);
    }
  });

  if (upcomingSessions.length > 0) {
    upcomingSessions.sort((a, b) => {
      const dateA = parseSessionDateTime(a);
      const dateB = parseSessionDateTime(b);
      return dateA.diff(dateB);
    });
    nextSession = upcomingSessions[0];
  }

  return {
    pendingCount,
    upcomingCount,
    totalSessions,
    nextSession,
  };
};
