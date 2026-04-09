import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import dayjs from 'dayjs';

export const SessionList = ({ sessions }) => {
  const navigate = useNavigate();

  if (!sessions || sessions.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-500">
        No sessions yet. Start by booking a teacher.
      </Card>
    );
  }

  const sortedSessions = [...sessions].sort((a, b) => {
    const bDate = dayjs(
      b?.session_date && b?.slot_start_time
        ? `${b.session_date}T${b.slot_start_time}`
        : b?.startTime || b?.date || b?.created_at
    );
    const aDate = dayjs(
      a?.session_date && a?.slot_start_time
        ? `${a.session_date}T${a.slot_start_time}`
        : a?.startTime || a?.date || a?.created_at
    );
    return bDate.diff(aDate);
  }).slice(0, 5);

  return (
    <Card className="overflow-hidden p-0 shadow-sm border border-slate-200 rounded-xl">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-lg font-bold text-slate-800">Recent Sessions</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {sortedSessions.map((session, index) => {
          const sessionDate = dayjs(
            session?.session_date && session?.slot_start_time
              ? `${session.session_date}T${session.slot_start_time}`
              : session?.startTime || session?.date || session?.created_at
          );
          const teacherName =
            session?.teacher_name ||
            (session?.teacher?.firstName
              ? `${session.teacher.firstName} ${session.teacher.lastName || ''}`.trim()
              : null) ||
            session?.teacher_id ||
            'Teacher';
          const normalizedStatus = String(session.status || '').toLowerCase();

          const statusClass = normalizedStatus === 'accepted'
            ? 'bg-emerald-50 text-emerald-700'
            : normalizedStatus === 'pending' || normalizedStatus === 'requested' || normalizedStatus === 'open'
            ? 'bg-amber-50 text-amber-700'
            : normalizedStatus === 'completed'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-700';

          return (
            <div key={session.id || index} className="p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-slate-900">{session.topic || session.topic_description || 'Tutoring'}</span>
                <span className="text-sm text-slate-500">with {teacherName}</span>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-1/2">
                <div className="flex flex-col gap-1 text-sm text-slate-500 sm:items-end">
                  <span>{sessionDate.format('MMM D, YYYY')}</span>
                  <span>{sessionDate.format('h:mm A')}</span>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap ${statusClass}`}>
                    {session.status || 'Unknown'}
                  </span>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => navigate(`/sessions/${session.id}`, { state: { session } })}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
