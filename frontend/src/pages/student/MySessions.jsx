import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/modals/Modal';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { usePaymentStore } from '../../stores/paymentStore';
import toast from 'react-hot-toast';

const TAB_DEFINITIONS = [
  { key: 'pending', label: 'Pending' },
  { key: 'open', label: 'Open Classes' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Cancelled/Rejected' },
  { key: 'all', label: 'All Sessions' },
];

function getStatusCategory(session) {
  const status = session?.status;
  if (status === 'Requested' || status === 'Rescheduled') return 'pending';

  // Keep enrolled group classes (open or started) under Open Classes,
  // not in generic Upcoming list.
  if (session?.session_type === 'group' && (status === 'Open' || status === 'Accepted')) {
    return 'open';
  }

  if (status === 'Accepted') return 'upcoming';
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled' || status === 'Rejected') return 'closed';
  return 'all';
}

function getApiErrorMessage(error, fallbackMessage) {
  const status = error?.response?.status;
  if (status === 403) return "You don't have permission to access these sessions.";
  if (status === 404) return 'Session not found. It may have been deleted.';
  if (status === 408 || error?.code === 'ECONNABORTED') {
    return 'Request timed out. Please check your connection and retry.';
  }
  if (status >= 500) return 'Server error. Please try again later.';

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

function canJoinSession(session) {
  const startAt = getSessionStartDateTime(session);
  if (!startAt) return false;
  return new Date() >= startAt;
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

export default function MySessions() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(null);

  const [activeTab, setActiveTab] = useState('pending');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [rejectedSession, setRejectedSession] = useState(null);
  const [substituteSession, setSubstituteSession] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const timezoneLabel = useMemo(() => getTimezoneLabel(), []);

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const openPaymentModal = usePaymentStore((state) => state.openPaymentModal);
  const isTeacher = user?.role === 'teacher';
  const handledNotificationRef = useRef(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await apiClient.get('/sessions/my?skip=0&limit=100');
      const items = data.items || (Array.isArray(data) ? data : []);

      let latestPaymentStatusBySession = {};
      try {
        const { data: txData } = await apiClient.get('/payments/transactions?skip=0&limit=100');
        const txItems = txData.items || [];
        latestPaymentStatusBySession = txItems.reduce((acc, tx) => {
          const sid = String(tx?.session_id || '');
          const status = String(tx?.status || '').toLowerCase();
          if (!sid || !status) return acc;

          // Prefer captured if present; otherwise keep the first (latest) status.
          if (!acc[sid] || status === 'captured') {
            acc[sid] = status;
          }
          return acc;
        }, {});
      } catch {
        // Do not block session list if payments endpoint is temporarily unavailable.
      }

      const enrichedItems = items.map((session) => {
        const statusFromTx = latestPaymentStatusBySession[String(session.id)];
        const paymentStatus = String(session.payment_status || statusFromTx || '').toLowerCase() || null;
        const isPaid = Boolean(session.is_paid || paymentStatus === 'captured');
        return {
          ...session,
          payment_status: paymentStatus,
          is_paid: isPaid,
        };
      });

      setSessions(enrichedItems);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
      const message = getApiErrorMessage(err, 'Failed to load sessions.');
      setLoadError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (isTeacher || !sessions.length) return;

    const context = location.state?.notificationContext;
    const action = location.state?.action;

    if (context?.id && handledNotificationRef.current !== context.id) {
      handledNotificationRef.current = context.id;
      const target = sessions.find((s) => s.id === context.referenceId);

      if (action === 'open-rejected-popup' && target) {
        setRejectedSession(target);
        setActiveTab('closed');
      }

      if (action === 'open-substitute-popup' && target) {
        setSubstituteSession(target);
        setActiveTab('pending');
      }

      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const pendingSubstitute = sessions.find(
      (s) => s.status === 'Rescheduled' && !sessionStorage.getItem(`shown-substitute-${s.id}`)
    );
    if (pendingSubstitute) {
      sessionStorage.setItem(`shown-substitute-${pendingSubstitute.id}`, '1');
      setSubstituteSession(pendingSubstitute);
      setActiveTab('pending');
      return;
    }

    const rejected = sessions.find(
      (s) => s.status === 'Rejected' && !sessionStorage.getItem(`shown-rejected-${s.id}`)
    );
    if (rejected) {
      sessionStorage.setItem(`shown-rejected-${rejected.id}`, '1');
      setRejectedSession(rejected);
      setActiveTab('closed');
    }
  }, [isTeacher, location.pathname, location.state, navigate, sessions]);

  const handleSessionAction = async (sessionId, action, payload = {}) => {
    setIsActionLoading(sessionId);
    try {
      if (action === 'pay') {
        openPaymentModal(
          sessionId,
          async () => {
            toast.success('Payment successful');
            await fetchSessions();
          },
          (err) => {
            const failureMessage = err?.message || 'Payment failed. Please try again.';
            toast.error(failureMessage);
          },
        );
        return;
      }

      const endpoints = {
        cancel: `/sessions/${sessionId}/cancel`,
        'accept-substitute': `/sessions/${sessionId}/accept-substitute`,
        'reject-substitute': `/sessions/${sessionId}/reject-substitute`,
        join: `/sessions/${sessionId}/join`,
      };

      const method = action === 'join' ? 'get' : 'put';
      const config = method === 'put'
        ? { method, url: endpoints[action], data: payload }
        : { method, url: endpoints[action] };

      const { data } = await apiClient(config);

      if (action === 'join') {
        navigate(`/sessions/${sessionId}/meeting`, {
          state: {
            meetingLink: data.meeting_link,
            jwtToken: data.jwt_token,
            roomName: data.room_name,
            userRole: 'student',
          },
        });
      } else {
        const successText = {
          cancel: 'Session cancelled successfully!',
          'accept-substitute': 'Proposed time accepted successfully!',
          'reject-substitute': 'Proposed time rejected successfully!',
        };
        toast.success(successText[action] || 'Session updated successfully!');
        await fetchSessions();
        setSubstituteSession(null);
      }
    } catch (error) {
      console.error(`Failed to ${action} session:`, error);
      const message = getApiErrorMessage(error, `Failed to ${action} session.`);
      if (action === 'join') {
        setJoinError({
          sessionId,
          message: typeof message === 'string' ? message : JSON.stringify(message),
        });
      } else {
        toast.error(message);
      }
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleViewDetails = (session) => {
    navigate(`/sessions/${session.id}`, { state: { session } });
  };

  const getStatusConfig = (status) => {
    const statusMap = {
      Requested: { color: 'bg-amber-100 text-amber-700', icon: '⏳' },
      Accepted: { color: 'bg-emerald-100 text-emerald-700', icon: '✓' },
      Rejected: { color: 'bg-red-100 text-red-700', icon: '✗' },
      Completed: { color: 'bg-blue-100 text-blue-700', icon: '✓✓' },
      Cancelled: { color: 'bg-slate-100 text-slate-700', icon: '-' },
      Open: { color: 'bg-purple-100 text-purple-700', icon: '⊙' },
      Rescheduled: { color: 'bg-orange-100 text-orange-700', icon: '↻' },
    };
    return statusMap[status] || { color: 'bg-slate-100 text-slate-700', icon: '•' };
  };

  const formatSessionDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const subjectOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(sessions.map((s) => s.subject_master_id).filter(Boolean)))];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const tabStatus = getStatusCategory(session);
      const tabMatch = activeTab === 'all' || tabStatus === activeTab;

      // Upcoming should contain only future sessions.
      const startAt = getSessionStartDateTime(session);
      const upcomingTimeMatch = activeTab !== 'upcoming' || !startAt || startAt >= new Date();

      const statusMatch = statusFilter === 'all' || session.status === statusFilter;
      const subjectMatch = subjectFilter === 'all' || session.subject_master_id === subjectFilter;

      const d = new Date(session.session_date);
      const fromMatch = !fromDate || d >= new Date(fromDate);
      const toMatch = !toDate || d <= new Date(toDate);

      return tabMatch && upcomingTimeMatch && statusMatch && subjectMatch && fromMatch && toMatch;
    });
  }, [sessions, activeTab, statusFilter, subjectFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = filteredSessions.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [activeTab, statusFilter, subjectFilter, fromDate, toDate, pageSize]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const getAvailableActions = (session) => {
    const isGroupSession = session.session_type === 'group';
    if (!isGroupSession && session.student_id !== user?.user_name) return [];

    const actions = [];
    if (isGroupSession && session.status === 'Open') {
      actions.push({
        label: 'Waiting for Teacher to Start',
        action: 'join',
        variant: 'blue',
        disabled: true,
      });
      return actions;
    }

    if (session.status === 'Accepted') {
      const joinAllowed = canJoinSession(session);
      actions.push({
        label: joinAllowed ? 'Join Meeting' : `Join At ${formatJoinOpenAt(session)}`,
        action: 'join',
        variant: 'blue',
        disabled: !joinAllowed,
      });
    }
    if (session.status === 'Completed') {
      const paid = session.is_paid || String(session.payment_status || '').toLowerCase() === 'captured';
      if (paid) {
        actions.push({ label: 'Paid', action: 'paid', variant: 'emerald', disabled: true });
      } else {
        actions.push({ label: 'Pay Now', action: 'pay', variant: 'emerald' });
      }
    }
    if (session.status === 'Requested') {
      actions.push({ label: 'Cancel Request', action: 'cancel', variant: 'red' });
    }
    if (session.status === 'Rescheduled') {
      actions.push({ label: 'Review Proposal', action: 'open-substitute-modal', variant: 'amber' });
    }

    return actions;
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 shadow-sm">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">My Sessions</h1>
        <p className="text-lg text-slate-700 mt-2">Track requests, upcoming classes, and completed sessions.</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200 overflow-x-auto">
        {TAB_DEFINITIONS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 font-semibold text-base border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-700 border-transparent hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="mb-5 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {['Requested', 'Rescheduled', 'Accepted', 'Completed', 'Cancelled', 'Rejected'].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            {subjectOptions.map((subjectId) => (
              <option key={subjectId} value={subjectId}>
                {subjectId === 'all' ? 'All subjects' : `Subject: ${subjectId}`}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600" />
        </div>
      ) : loadError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-red-200 shadow-sm" role="alert">
          <h3 className="text-2xl font-bold text-red-700 mb-2">Unable to load sessions</h3>
          <p className="text-base text-slate-700 font-medium mb-5">{String(loadError || 'Failed to load sessions.')}</p>
          <Button variant="primary" onClick={fetchSessions}>Retry</Button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-2xl font-bold text-slate-900 mb-1">No sessions found matching these filters</h3>
          <p className="text-base text-slate-600 font-medium">Try adjusting date range, status, or subject filters.</p>
          <div className="mt-5">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter('all');
                setSubjectFilter('all');
                setFromDate('');
                setToDate('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedSessions.map((session) => (
            <Card key={session.id} hoverable className="overflow-hidden border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {(() => {
                      const statusConfig = getStatusConfig(session.status);
                      return (
                        <>
                          <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${statusConfig.color} inline-flex items-center gap-1.5`}>
                            {statusConfig.icon} {session.status}
                          </span>
                          <span className="text-base font-medium text-slate-600">
                            {formatSessionDate(session.session_date)}
                          </span>
                        </>
                      );
                    })()}
                  </div>

                  {session.status === 'Accepted' && (
                    <p className="mt-2 text-sm text-slate-600">
                      Join opens at <span className="font-semibold text-slate-800">{formatJoinOpenAt(session)}</span>
                      <span className="text-slate-500"> ({timezoneLabel})</span>
                    </p>
                  )}

                  <div className="mt-3">
                    <h3 className="text-2xl font-bold text-slate-900">Teacher: {session.teacher_name || session.teacher_id}</h3>
                    <p className="text-slate-700 text-base mt-2 max-w-2xl leading-relaxed">
                      <strong>Topic:</strong> {session.topic_description || 'No specific topic'}
                    </p>
                    {(session.subject_name || session.subject_master_id) && (
                      <p className="text-slate-700 text-base mt-1.5">
                        <strong>Subject:</strong> {session.subject_name || session.subject_master_id}
                      </p>
                    )}
                    {session.session_type === 'group' && (
                      <p className="text-slate-700 text-base mt-1.5">
                        <strong>Group Price:</strong>{' '}
                        {Number.isFinite(Number(session.group_per_student_charges))
                          ? `Rs. ${Number(session.group_per_student_charges)} per student`
                          : 'Not published yet'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto mt-4 md:mt-0">
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex flex-col md:flex-row gap-2.5 justify-end items-center">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleViewDetails(session)}
                    className="w-full md:w-auto"
                  >
                    View Details
                  </Button>
                  {getAvailableActions(session).map((actionBtn) => {
                    const colorMap = {
                      blue: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
                      emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
                      amber: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
                      red: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
                    };
                    return (
                      <button
                        key={actionBtn.action}
                        onClick={() => {
                          if (actionBtn.disabled) return;
                          if (actionBtn.action === 'open-substitute-modal') {
                            setSubstituteSession(session);
                            return;
                          }
                          handleSessionAction(session.id, actionBtn.action);
                        }}
                        disabled={isActionLoading === session.id || actionBtn.disabled}
                        className={`px-4 py-2.5 rounded-lg text-base font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${colorMap[actionBtn.variant]}`}
                      >
                        {isActionLoading === session.id ? (
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </span>
                        ) : (
                          actionBtn.label
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}

          <div className="pt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-base text-slate-700 font-medium">Page {page + 1} of {totalPages}</div>
            <div className="flex gap-2">
              <select
                className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
              </select>
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((prev) => Math.max(0, prev - 1))}>
                Previous
              </Button>
              <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(rejectedSession)}
        onClose={() => setRejectedSession(null)}
        title="Session Not Accepted"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setRejectedSession(null)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                setRejectedSession(null);
                navigate('/teachers');
              }}
            >
              Find Another Teacher
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">
          This teacher is not available right now. Please try again later or choose another teacher.
        </p>
      </Modal>

      <Modal
        isOpen={Boolean(substituteSession)}
        onClose={() => setSubstituteSession(null)}
        title="Teacher Proposed an Alternate Time"
        size="md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setSubstituteSession(null)}>Close</Button>
            <Button
              variant="danger"
              onClick={() => handleSessionAction(substituteSession.id, 'reject-substitute')}
              loading={isActionLoading === substituteSession?.id}
            >
              Reject Proposal
            </Button>
            <Button
              variant="success"
              onClick={() => handleSessionAction(substituteSession.id, 'accept-substitute')}
              loading={isActionLoading === substituteSession?.id}
            >
              Accept Proposal
            </Button>
          </>
        )}
      >
        {substituteSession && (
          <div className="space-y-3">
            <p className="text-slate-600">Your teacher proposed a different session schedule.</p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <strong>Proposed schedule:</strong> {formatSessionDate(substituteSession.session_date)}
            </div>
            <p className="text-xs text-slate-500">
              If accepted, this session will move to the proposed date and become confirmed.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(joinError)}
        onClose={() => setJoinError(null)}
        title="Unable to Join Meeting"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setJoinError(null)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                handleSessionAction(joinError.sessionId, 'join');
              }}
            >
              Retry
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">{String(joinError?.message || 'Unable to join meeting.')}</p>
      </Modal>
    </div>
  );
}
