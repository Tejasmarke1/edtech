import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../api/client';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { usePaymentStore } from '../../stores/paymentStore';

function getApiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.msg || item.message || '';
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();

    if (firstMessage) return firstMessage;
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || fallbackMessage;
  }
  return fallbackMessage;
}

function formatSessionDate(dateValue) {
  try {
    return new Date(dateValue).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateValue;
  }
}

function getStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();

  const statusMap = {
    requested: { label: 'Requested', color: 'warning' },
    accepted: { label: 'Accepted', color: 'success' },
    rejected: { label: 'Rejected', color: 'error' },
    completed: { label: 'Completed', color: 'primary' },
    cancelled: { label: 'Cancelled', color: 'gray' },
    rescheduled: { label: 'Rescheduled', color: 'warning' },
    open: { label: 'Open', color: 'gray' },
  };

  return statusMap[normalized] || { label: status || 'Unknown', color: 'gray' };
}

export default function SessionDetail() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const openPaymentModal = usePaymentStore((state) => state.openPaymentModal);

  const [session, setSession] = useState(location.state?.session || null);
  const [isLoading, setIsLoading] = useState(!location.state?.session);
  const [isActionLoading, setIsActionLoading] = useState(null);
  const [error, setError] = useState('');
  const timezoneLabel = useMemo(() => getTimezoneLabel(), []);

  const isTeacher = user?.role === 'teacher';

  const isSessionPaid = useMemo(() => {
    if (!session) return false;
    return Boolean(session.is_paid || String(session.payment_status || '').toLowerCase() === 'captured');
  }, [session]);

  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [{ data }, txResponse] = await Promise.all([
        apiClient.get('/sessions/my?skip=0&limit=100'),
        apiClient.get('/payments/transactions?skip=0&limit=200').catch(() => ({ data: { items: [] } })),
      ]);

      const items = data.items || (Array.isArray(data) ? data : []);
      const found = items.find((item) => item.id === sessionId);

      if (!found) {
        setSession(null);
        setError('Session not found.');
        return;
      }

      const txItems = txResponse?.data?.items || [];
      const txForSession = txItems.find((tx) => String(tx.session_id) === String(found.id));
      const normalizedPaymentStatus = String(found.payment_status || txForSession?.status || '').toLowerCase() || null;
      const normalizedSession = {
        ...found,
        payment_status: normalizedPaymentStatus,
        is_paid: Boolean(found.is_paid || normalizedPaymentStatus === 'captured'),
      };

      setSession(normalizedSession);
    } catch (fetchError) {
      console.error('Failed to load session details:', fetchError);
      setError(getApiErrorMessage(fetchError, 'Failed to load session details.'));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!location.state?.session) {
      fetchSession();
      return;
    }

    setSession(location.state.session);
    setIsLoading(false);
    fetchSession();
  }, [fetchSession, location.state]);

  const availableActions = useMemo(() => {
    if (!session) return [];

    const status = session.status;
    const actions = [];

    if (isTeacher) {
      if (status === 'Requested' || status === 'Rescheduled') {
        actions.push({ label: 'Accept', action: 'accept', variant: 'success' });
        actions.push({ label: 'Reject', action: 'reject', variant: 'danger' });
      }

      if (status === 'Accepted') {
        const joinAllowed = canJoinSessionNow(session);
        actions.push({
          label: joinAllowed ? 'Join Session' : `Join At ${formatJoinOpenAt(session)}`,
          action: 'join',
          variant: 'primary',
          disabled: !joinAllowed,
        });
        actions.push({ label: 'Mark Complete', action: 'complete', variant: 'secondary' });
      }
    } else {
      if (status === 'Accepted') {
        const joinAllowed = canJoinSessionNow(session);
        actions.push({
          label: joinAllowed ? 'Join Session' : `Join At ${formatJoinOpenAt(session)}`,
          action: 'join',
          variant: 'primary',
          disabled: !joinAllowed,
        });
      }

      if (status === 'Completed' && !isSessionPaid) {
        actions.push({ label: 'Pay Now', action: 'pay', variant: 'success' });
      }

      if (status === 'Requested' || status === 'Rescheduled') {
        actions.push({ label: 'Cancel Request', action: 'cancel', variant: 'danger' });
      }
    }

    return actions;
  }, [isSessionPaid, isTeacher, session]);

  const timeline = useMemo(() => {
    if (!session) return [];

    const status = session.status;
    return [
      {
        title: 'Request created',
        description: 'The session was added to the schedule queue.',
        active: true,
      },
      {
        title: 'Teacher review',
        description: 'Teacher can accept, reject, or propose another time.',
        active: ['Requested', 'Rescheduled', 'Accepted', 'Completed'].includes(status),
      },
      {
        title: 'Live meeting',
        description: 'Join the session through the embedded meeting flow.',
        active: ['Accepted', 'Completed'].includes(status),
      },
      {
        title: 'Completion and rating',
        description: 'Once complete, the session can be rated and paid.',
        active: status === 'Completed',
      },
    ];
  }, [session]);

  const handleJoin = async () => {
    if (!session) return;

    setIsActionLoading('join');
    try {
      const { data } = await apiClient.get(`/sessions/${session.id}/join`);
      navigate(`/sessions/${session.id}/meeting`, {
        state: {
          meetingLink: data.meeting_link,
          jwtToken: data.jwt_token,
          roomName: data.room_name,
          userRole: session.teacher_id === user?.user_name ? 'teacher' : 'student',
          subject: session.subject_master_id,
        },
      });
    } catch (joinError) {
      console.error('Failed to join session:', joinError);
      toast.error(getApiErrorMessage(joinError, 'Failed to join session.'));
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSessionAction = async (action) => {
    if (!session) return;

    if (action === 'pay') {
      openPaymentModal(
        session.id,
        async () => {
          toast.success('Payment successful');
          await fetchSession();
        },
        (paymentError) => {
          toast.error(paymentError?.message || 'Payment failed. Please try again.');
        }
      );
      return;
    }

    if (action === 'join') {
      await handleJoin();
      return;
    }

    setIsActionLoading(action);
    try {
      const endpointMap = {
        accept: `/sessions/${session.id}/accept`,
        reject: `/sessions/${session.id}/reject`,
        cancel: `/sessions/${session.id}/cancel`,
        complete: `/sessions/${session.id}/complete`,
      };

      await apiClient.put(endpointMap[action]);
      toast.success('Session updated successfully.');
      await fetchSession();
    } catch (actionError) {
      console.error(`Failed to ${action} session:`, actionError);
      toast.error(getApiErrorMessage(actionError, `Failed to ${action} session.`));
    } finally {
      setIsActionLoading(null);
    }
  };

  if (isLoading && !session) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Session not available</h1>
          <p className="text-slate-600 mb-6">{error || 'This session could not be loaded.'}</p>
          <Button variant="secondary" onClick={() => navigate(isTeacher ? '/teacher-sessions' : '/my-sessions')}>
            Back to Sessions
          </Button>
        </Card>
      </div>
    );
  }

  const statusMeta = getStatusMeta(session.status);
  const counterpartLabel = isTeacher ? 'Student' : 'Teacher';
  const counterpartId = isTeacher ? session.student_id : (session.teacher_name || session.teacher_id);

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(isTeacher ? '/teacher-sessions' : '/my-sessions')}>
            Back to Sessions
          </Button>
          <div className="space-y-2">
            <Badge variant="solid" color={statusMeta.color}>
              {statusMeta.label}
            </Badge>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {session.topic_description || 'Session Details'}
            </h1>
            <p className="text-slate-500">
              {counterpartLabel}: {counterpartId || 'Not available'} · {formatSessionDate(session.session_date)}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {availableActions.map((actionButton) => (
            <Button
              key={actionButton.action}
              variant={actionButton.variant}
              disabled={actionButton.disabled}
              loading={isActionLoading === actionButton.action}
              onClick={() => handleSessionAction(actionButton.action)}
            >
              {actionButton.label}
            </Button>
          ))}
        </div>
      </div>

      {session.status === 'Accepted' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Join opens at <span className="font-semibold">{formatJoinOpenAt(session)}</span>
          <span className="text-blue-700"> ({timezoneLabel})</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
            <span className="text-sm text-slate-500 font-medium">Session ID: {session.id}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Subject</p>
              <p className="font-semibold text-slate-900">{session.subject_master_id}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Type</p>
              <p className="font-semibold text-slate-900">{session.session_type || 'Individual'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Date</p>
              <p className="font-semibold text-slate-900">{formatSessionDate(session.session_date)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Meeting Link</p>
              <p className="font-semibold text-slate-900 break-all">{session.meeting_link || 'Will appear once created'}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Topic</p>
            <p className="text-slate-700 leading-6">
              {session.topic_description || 'No topic description was provided for this session.'}
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Session Info</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-500 uppercase tracking-wide text-xs font-semibold mb-1">{counterpartLabel}</p>
              <p className="font-semibold text-slate-900 break-all">{counterpartId || 'Not available'}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wide text-xs font-semibold mb-1">Created</p>
              <p className="font-medium text-slate-800">{formatSessionDate(session.created_at)}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wide text-xs font-semibold mb-1">Updated</p>
              <p className="font-medium text-slate-800">{formatSessionDate(session.updated_at)}</p>
            </div>
            {session.max_students && (
              <div>
                <p className="text-slate-500 uppercase tracking-wide text-xs font-semibold mb-1">Max Students</p>
                <p className="font-medium text-slate-800">{session.max_students}</p>
              </div>
            )}
          </div>

          {session.status === 'Completed' && !isTeacher && !isSessionPaid && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-800 mb-2">Session complete</p>
              <p className="text-sm text-emerald-700 mb-4">You can proceed to payment and leave a rating from here.</p>
              <Button variant="success" className="w-full" onClick={() => handleSessionAction('pay')}>
                Pay Now
              </Button>
            </div>
          )}

          {session.status === 'Completed' && !isTeacher && isSessionPaid && (
            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-800 mb-1">Payment completed</p>
              <p className="text-sm text-blue-700">This session has already been paid.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Timeline</h2>
          <div className="space-y-4">
            {timeline.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className={`mt-1 h-3 w-3 rounded-full ${step.active ? 'bg-blue-600' : 'bg-slate-300'}`} />
                <div className="flex-1">
                  <p className={`font-semibold ${step.active ? 'text-slate-900' : 'text-slate-500'}`}>
                    {index + 1}. {step.title}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Quick Actions</h2>
          <div className="space-y-3">
            <Button
              variant="secondary"
              className="w-full justify-between"
              onClick={() => navigate(isTeacher ? '/teacher-sessions' : '/my-sessions')}
            >
              <span>Return to session list</span>
              <span aria-hidden="true">→</span>
            </Button>
            {session.status === 'Accepted' && (
              <Button
                variant="primary"
                className="w-full justify-between"
                onClick={() => handleSessionAction('join')}
                disabled={!canJoinSessionNow(session)}
                loading={isActionLoading === 'join'}
              >
                <span>Join meeting</span>
                <span aria-hidden="true">↗</span>
              </Button>
            )}
            {!isTeacher && session.status === 'Completed' && !isSessionPaid && (
              <Button variant="success" className="w-full justify-between" onClick={() => handleSessionAction('pay')}>
                <span>Proceed to payment</span>
                <span aria-hidden="true">💳</span>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function getSessionStartDateTime(session) {
  if (!session?.session_date) return null;
  if (!session?.slot_start_time) {
    const day = new Date(session.session_date);
    day.setHours(0, 0, 0, 0);
    return day;
  }
  const dt = new Date(`${session.session_date}T${session.slot_start_time}:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatJoinOpenAt(session) {
  const startAt = getSessionStartDateTime(session);
  if (!startAt) return 'session time';
  return startAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function canJoinSessionNow(session) {
  const startAt = getSessionStartDateTime(session);
  if (!startAt) return false;
  return new Date() >= startAt;
}

function getTimezoneLabel() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
    const shortName = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [shortName, iana].filter(Boolean).join(' ');
  } catch {
    return 'local time';
  }
}