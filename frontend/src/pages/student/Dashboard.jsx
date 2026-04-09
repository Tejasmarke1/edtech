import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMySessions } from '../../features/dashboard/hooks';
import { StatCard } from '../../features/dashboard/components/StatCard';
import { NextSessionCard } from '../../features/dashboard/components/NextSessionCard';
import { SessionList } from '../../features/dashboard/components/SessionList';
import Button from '../../components/ui/Button';

export default function Dashboard() {
  const navigate = useNavigate();
  const { sessions, stats, isLoading, error, refetch } = useMySessions();

  if (error) {
    return (
      <div className="w-full px-4 lg:px-8 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-red-500 mb-4 bg-red-50 p-6 rounded-xl border border-red-100 flex flex-col items-center">
          <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold text-lg">{error}</p>
        </div>
        <Button onClick={refetch} className="bg-red-600 hover:bg-red-700">Retry Request</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full px-4 lg:px-8 py-6 animate-pulse">
        <div className="mb-8">
          <div className="h-10 bg-slate-200 rounded-md w-1/4 mb-3"></div>
          <div className="h-5 bg-slate-200 rounded-md w-2/5"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-8 bg-slate-200 w-32 mb-4 rounded-md"></div>
        <div className="h-44 bg-slate-200 rounded-xl mb-12"></div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-8 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Student Dashboard</h1>
        <p className="text-slate-500 mt-2">Welcome back! Here's an overview of your activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="Pending Requests"
          value={stats.pendingCount}
          colorClass="amber"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Upcoming Sessions"
          value={stats.upcomingCount}
          colorClass="blue"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Total Sessions"
          value={stats.totalSessions}
          colorClass="purple"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-blue-50/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No sessions yet</h2>
          <p className="text-slate-500 mb-8 max-w-sm text-lg">Start by booking a teacher. Your upcoming and past sessions will show up here.</p>
          <Button
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
            onClick={() => navigate('/teachers')}
          >
            Find Teachers
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold text-slate-900 mb-4 px-1">Upcoming Focus</h2>
          <NextSessionCard session={stats.nextSession} />

          <div className="mt-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4 px-1">Recent Activity</h2>
            <SessionList sessions={sessions} />
          </div>
        </>
      )}
    </div>
  );
}
