import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, Badge, Button, Spinner } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherProfile } from '../../features/teacher/hooks';
import teacherAPI from '../../features/teacher/api';
import apiClient from '../../api/client';
import paymentsApi from '../../features/payments/api';

/**
 * Teacher Dashboard
 * Overview of teacher's sessions, earnings, and profile status
 */
function getProfileCompletenessLevel(profile, assets) {
  if (!profile) return { score: 0, percentage: 0, missing: [], checks: {} };

  const subjectCount = assets?.subjects?.length || 0;
  const availabilityCount = assets?.availability?.length || 0;
  const videoCount = assets?.videoCount || 0;

  const checks = {
    bio: { completed: !!profile.bio, label: 'Bio/About' },
    pricing: {
      completed:
        Number(profile.per_30_mins_charges || 0) > 0 &&
        Number(profile.group_per_student_charges || 0) > 0,
      label: 'Pricing Set',
    },
    subjects: { completed: subjectCount >= 1, label: 'Subjects Added' },
    videos: { completed: videoCount >= 1, label: 'Demo Videos' },
    availability: { completed: availabilityCount >= 1, label: 'Availability Set' },
  };

  let completedCount = 0;
  const missing = [];

  Object.entries(checks).forEach(([, check]) => {
    if (check.completed) completedCount++;
    else missing.push(check.label);
  });

  return {
    score: completedCount,
    percentage: Math.round((completedCount / Object.keys(checks).length) * 100),
    missing,
    checks,
  };
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { profile, loading: profileLoading, refetch } = useTeacherProfile();
  const [assets, setAssets] = useState({ subjects: [], availability: [], videoCount: 0 });
  const [summary, setSummary] = useState({
    totalSessions: 0,
    completedSessions: 0,
    avgRating: 0,
    currentBalance: 0,
    recentSessions: [],
  });

  const displayName = user?.profile?.full_name || user?.name || user?.user_name || 'Teacher';

  useEffect(() => {
    const loadCompletenessAssets = async () => {
      try {
        const [subjects, availabilityRes] = await Promise.all([
          teacherAPI.getTeacherSubjects(),
          teacherAPI.getAvailability(),
        ]);

        const availability = Array.isArray(availabilityRes?.items)
          ? availabilityRes.items
          : Array.isArray(availabilityRes)
            ? availabilityRes
            : [];

        const videosPerSubject = await Promise.all(
          (subjects || []).map((subject) => teacherAPI.getVideos(subject.sub_id).catch(() => []))
        );

        const videoCount = videosPerSubject.reduce((sum, list) => sum + (list?.length || 0), 0);
        setAssets({ subjects: subjects || [], availability, videoCount });
      } catch {
        setAssets({ subjects: [], availability: [], videoCount: 0 });
      }
    };

    loadCompletenessAssets();
  }, [profile?.updated_at]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [walletRes, ratingsRes, sessionsRes] = await Promise.allSettled([
          paymentsApi.getTeacherWallet(),
          apiClient.get('/ratings/history'),
          apiClient.get('/sessions/my?skip=0&limit=100'),
        ]);

        const wallet = walletRes.status === 'fulfilled' ? walletRes.value : null;
        const ratingRows = ratingsRes.status === 'fulfilled' ? (ratingsRes.value?.data?.received || []) : [];
        const sessionItems = sessionsRes.status === 'fulfilled'
          ? (sessionsRes.value?.data?.items || (Array.isArray(sessionsRes.value?.data) ? sessionsRes.value.data : []))
          : [];

        const avgRating = ratingRows.length
          ? ratingRows.reduce((acc, row) => acc + Number(row.stars || 0), 0) / ratingRows.length
          : 0;

        const completedSessions = sessionItems.filter((s) => String(s.status || '').toLowerCase() === 'completed').length;
        const recentSessions = [...sessionItems]
          .sort((a, b) => {
            const bTime = new Date(`${b.session_date || ''}T${b.slot_start_time || '00:00'}`).getTime();
            const aTime = new Date(`${a.session_date || ''}T${a.slot_start_time || '00:00'}`).getTime();
            return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
          })
          .slice(0, 5);

        setSummary({
          totalSessions: sessionItems.length,
          completedSessions,
          avgRating,
          currentBalance: wallet?.current_balance || 0,
          recentSessions,
        });
      } catch {
        // Keep dashboard accessible even when summary endpoints fail.
      }
    };

    loadSummary();
  }, [profile?.updated_at]);

  const completeness = getProfileCompletenessLevel(profile, assets);
  const isComplete = completeness.percentage === 100;

  useEffect(() => {
    // Auto-refresh profile data periodically
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  const stats = [
    { label: 'Total Sessions', value: summary.totalSessions, color: 'blue' },
    { label: 'Completed', value: summary.completedSessions, color: 'purple' },
    { label: 'Current Balance', value: `Rs. ${summary.currentBalance}`, color: 'green' },
    { label: 'Avg Rating', value: summary.avgRating.toFixed(1), color: 'amber' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Section */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 shadow-sm">
        <h2 className="text-4xl font-bold text-slate-900 mb-2">Welcome, {displayName}</h2>
        <p className="text-lg text-slate-700">Here's your teaching overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden border border-slate-200 shadow-sm">
            <CardBody>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-700 text-base font-semibold">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                </div>
                <Badge variant="soft" color={stat.color}>
                  →
                </Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Profile Completeness */}
      <Card className={`mb-6 border-2 ${isComplete ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Profile Completeness
              <Badge variant="solid" color={isComplete ? 'green' : 'amber'}>
                {completeness.percentage}%
              </Badge>
            </h3>
            {!isComplete && <Button size="sm" variant="outlined" onClick={() => navigate('/teacher-profile')}>Complete Profile</Button>}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-base font-semibold text-slate-900">Overall Progress</span>
              <span className="text-base font-semibold text-slate-700">{completeness.score}/5</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(completeness.checks).map(([key, check]) => (
              <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-white">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-sm ${
                    check.completed
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  {check.completed ? '✓' : '○'}
                </div>
                <span className={check.completed ? 'text-base text-slate-900 font-semibold' : 'text-base text-slate-700'}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>

          {!isComplete && (
            <div className="p-4 bg-white rounded-lg border border-amber-200">
              <p className="text-base font-semibold text-slate-900 mb-2">Next Steps:</p>
              <ul className="text-base text-slate-700 space-y-1">
                {completeness.missing.map((item) => (
                  <li key={item}>• Complete: {item}</li>
                ))}
              </ul>
              <p className="text-sm text-slate-700 mt-3">
                Complete all steps to appear in student search results and enable bookings.
              </p>
            </div>
          )}

          {isComplete && (
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <p className="text-base font-semibold text-green-700">✓ Profile Complete!</p>
              <p className="text-sm text-slate-700 mt-2">
                Your profile is now visible to students. You can accept bookings and start teaching!
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Important Notice - If Incomplete */}
      {!isComplete && (
        <Card className="mb-6 bg-red-50 border-2 border-red-200">
          <CardHeader>
            <h3 className="text-xl font-bold text-red-900 flex items-center gap-2">
              ⚠ Profile Incomplete
            </h3>
          </CardHeader>
          <CardBody>
            <p className="text-base text-red-800">
              Your profile is not yet discoverable by students. Complete all required sections in your profile to enable student discovery and bookings.
            </p>
            <Button
              onClick={() => navigate('/teacher-profile')}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              Go to Profile
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-bold text-slate-900">Recent Sessions</h3>
        </CardHeader>
        <CardBody>
          {summary.recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base text-slate-700 font-medium">No sessions yet</p>
              <p className="text-base text-slate-600 mt-2">Once your profile is complete, students can book sessions with you</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.recentSessions.map((session) => {
                const dateLabel = session?.session_date
                  ? new Date(`${session.session_date}T${session.slot_start_time || '00:00'}`).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'Date unavailable';

                return (
                  <div key={session.id} className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{session.topic_description || session.subject_name || 'Session'}</p>
                      <p className="text-sm text-slate-600">{dateLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="soft" color="blue">{session.status}</Badge>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => navigate(`/teacher/sessions/${session.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
