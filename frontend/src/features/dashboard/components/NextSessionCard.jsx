import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import dayjs from 'dayjs';

export const NextSessionCard = ({ session }) => {
  const navigate = useNavigate();

  if (!session) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-12 bg-white flex-1 mb-8">
        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-6 ring-8 ring-slate-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No upcoming sessions</h3>
        <p className="text-slate-500 max-w-sm mb-6 text-base">Looks like you have a free schedule. Head over to Find Teachers to request a new session.</p>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => navigate('/teachers')}
        >
          Find Teachers
        </Button>
      </Card>
    );
  }

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

  return (
    <Card className="mb-8 border-l-4 border-l-blue-600 bg-white shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-70"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div>
          <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-1">Next Up</h2>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{session.topic || session.topic_description || 'Tutoring Session'}</h3>
          <p className="text-slate-600 font-medium">with <span className="text-slate-900 font-semibold">{teacherName}</span></p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-md font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {sessionDate.format('MMM D, YYYY')}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-md font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {sessionDate.format('h:mm A')}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3 min-w-40">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 uppercase">
            {session.status || 'Accepted'}
          </span>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <Button
              variant="secondary"
              className="w-full md:w-auto shadow-md"
              onClick={() => navigate(`/sessions/${session.id}`, { state: { session } })}
            >
              View Details
            </Button>
            <Button
              className="w-full md:w-auto shadow-md"
              onClick={() => navigate(`/sessions/${session.id}/meeting`, { state: { session } })}
            >
              Join Session
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
