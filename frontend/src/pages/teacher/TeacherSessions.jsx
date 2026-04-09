import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/modals/Modal';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import teacherAPI from '../../features/teacher/api';

const TAB_DEFINITIONS = [
  { key: 'incoming', label: 'Incoming Requests' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Cancelled/Rejected' },
  { key: 'all', label: 'All Sessions' },
];

function getStatusCategory(status) {
  if (status === 'Requested' || status === 'Rescheduled') return 'incoming';
  if (status === 'Open') return 'upcoming';
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
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') return first.msg || fallbackMessage;
  }
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') return detail.msg || fallbackMessage;

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

export default function TeacherSessions() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(null);

  const [activeTab, setActiveTab] = useState('incoming');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [highlightedSessionId, setHighlightedSessionId] = useState(null);
  const [rejectModalSession, setRejectModalSession] = useState(null);
  const [proposeModalSession, setProposeModalSession] = useState(null);
  const [proposedSlotId, setProposedSlotId] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const timezoneLabel = useMemo(() => getTimezoneLabel(), []);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [isPublishingClass, setIsPublishingClass] = useState(false);
  const [openClassDraft, setOpenClassDraft] = useState({
    subject_master_id: '',
    custom_start_at: '',
    duration_minutes: 60,
    max_students: 10,
    topic_description: '',
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const handledNotificationRef = useRef(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await apiClient.get('/sessions/my?skip=0&limit=100');
      const items = data.items || (Array.isArray(data) ? data : []);
      setSessions(items);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setLoadError(getApiErrorMessage(error, 'Failed to load sessions.'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailability = async () => {
    try {
      const { data } = await apiClient.get('/teachers/availability?skip=0&limit=100');
      setAvailabilitySlots(data.items || (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Failed to fetch availability slots:', error);
    }
  };

  const fetchTeacherSubjects = async () => {
    try {
      const subjects = await teacherAPI.getTeacherSubjects();
      setTeacherSubjects(subjects || []);
      setOpenClassDraft((prev) => ({
        ...prev,
        subject_master_id: prev.subject_master_id || subjects?.[0]?.id || '',
      }));
    } catch (error) {
      console.error('Failed to fetch teacher subjects:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchAvailability();
    fetchTeacherSubjects();
  }, []);

  const handlePublishOpenClass = async () => {
    const { subject_master_id, custom_start_at, duration_minutes, max_students, topic_description } = openClassDraft;
    if (!subject_master_id || !custom_start_at) {
      toast.error('Select subject and class date-time to publish an open class.');
      return;
    }

    setIsPublishingClass(true);
    try {
      await apiClient.post('/sessions/group', {
        subject_master_id,
        custom_start_at,
        duration_minutes: Number(duration_minutes),
        max_students: Number(max_students),
        topic_description: topic_description || null,
      });
      toast.success('Open class published. Students can now discover and enroll.');
      setOpenClassDraft((prev) => ({
        ...prev,
        topic_description: '',
      }));
      await fetchSessions();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to publish open class.'));
    } finally {
      setIsPublishingClass(false);
    }
  };

  useEffect(() => {
    const context = location.state?.notificationContext;
    const action = location.state?.action;
    if (!context?.id || handledNotificationRef.current === context.id) return;

    handledNotificationRef.current = context.id;

    if (action === 'open-request-actions' && context.referenceId) {
      setActiveTab('incoming');
      setHighlightedSessionId(context.referenceId);
      toast.success('Session request opened for quick review.');
      window.setTimeout(() => {
        setHighlightedSessionId((prev) => (prev === context.referenceId ? null : prev));
      }, 4000);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const handleSessionAction = async (sessionId, action) => {
    setIsActionLoading(sessionId);
    try {
      const endpoints = {
        accept: `/sessions/${sessionId}/accept`,
        start: `/sessions/${sessionId}/start`,
        complete: `/sessions/${sessionId}/complete`,
        join: `/sessions/${sessionId}/join`,
      };

      if (action === 'join') {
        const { data } = await apiClient.get(endpoints[action]);
        navigate(`/teacher/sessions/${sessionId}/meeting`, {
          state: {
            meetingLink: data.meeting_link,
            jwtToken: data.jwt_token,
            roomName: data.room_name,
            userRole: 'teacher',
          },
        });
      } else {
        await apiClient.put(endpoints[action]);
        toast.success(`Session ${action}ed successfully!`);
        await fetchSessions();
      }
    } catch (error) {
      console.error(`Failed to ${action} session:`, error);
      const message = getApiErrorMessage(error, `Failed to ${action} session.`);
      if (action === 'join') {
        setJoinError({ sessionId, message });
      } else {
        toast.error(message);
      }
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleViewDetails = (session) => {
    navigate(`/teacher/sessions/${session.id}`, { state: { session } });
  };

  const handleOpenRejectModal = (session) => setRejectModalSession(session);

  const handleOpenProposeModal = (session) => {
    setProposeModalSession(session);
    setProposedSlotId(session.slot_id || availabilitySlots[0]?.id || '');
    setProposedDate(session.session_date || '');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalSession) return;
    setIsSubmittingModal(true);
    try {
      await apiClient.put(`/sessions/${rejectModalSession.id}/reject`);
      toast.success('Session rejected successfully.');
      setRejectModalSession(null);
      await fetchSessions();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to reject session.'));
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleSubmitProposedTime = async () => {
    if (!proposeModalSession) return;
    if (!proposedSlotId || !proposedDate) {
      toast.error('Please select an alternate slot and date.');
      return;
    }

    setIsSubmittingModal(true);
    try {
      await apiClient.put(`/sessions/${proposeModalSession.id}/propose-time`, {
        slot_id: proposedSlotId,
        session_date: proposedDate,
      });
      toast.success('Alternate time proposed to student.');
      setProposeModalSession(null);
      await fetchSessions();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to propose alternate time.'));
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const getStatusConfig = (status) => {
    const statusMap = {
      Requested: { color: 'bg-amber-100 text-amber-700', bgColor: 'bg-amber-50', icon: '⏳' },
      Accepted: { color: 'bg-emerald-100 text-emerald-700', bgColor: 'bg-emerald-50', icon: '✓' },
      Rejected: { color: 'bg-red-100 text-red-700', bgColor: 'bg-red-50', icon: '✗' },
      Completed: { color: 'bg-blue-100 text-blue-700', bgColor: 'bg-blue-50', icon: '✓✓' },
      Cancelled: { color: 'bg-slate-100 text-slate-700', bgColor: 'bg-slate-50', icon: '-' },
      Open: { color: 'bg-purple-100 text-purple-700', bgColor: 'bg-purple-50', icon: '⊙' },
      Rescheduled: { color: 'bg-orange-100 text-orange-700', bgColor: 'bg-orange-50', icon: '↻' },
    };
    return statusMap[status] || { color: 'bg-slate-100 text-slate-700', bgColor: 'bg-slate-50', icon: '•' };
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
      if (session.teacher_id !== user?.user_name) return false;

      const tabMatch = activeTab === 'all' || getStatusCategory(session.status) === activeTab;
      const statusMatch = statusFilter === 'all' || session.status === statusFilter;
      const subjectMatch = subjectFilter === 'all' || session.subject_master_id === subjectFilter;

      const d = new Date(session.session_date);
      const fromMatch = !fromDate || d >= new Date(fromDate);
      const toMatch = !toDate || d <= new Date(toDate);

      return tabMatch && statusMatch && subjectMatch && fromMatch && toMatch;
    });
  }, [sessions, user?.user_name, activeTab, statusFilter, subjectFilter, fromDate, toDate]);

  const requestedCount = sessions.filter((s) => s.teacher_id === user?.user_name && s.status === 'Requested').length;
  const acceptedCount = sessions.filter((s) => s.teacher_id === user?.user_name && s.status === 'Accepted').length;
  const completedCount = sessions.filter((s) => s.teacher_id === user?.user_name && s.status === 'Completed').length;

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = filteredSessions.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [activeTab, statusFilter, subjectFilter, fromDate, toDate, pageSize]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const getAvailableActions = (session) => {
    const actions = [];

    if (session.status === 'Requested' || session.status === 'Rescheduled') {
      actions.push({ label: 'Accept', action: 'accept', variant: 'emerald' });
      if (session.status === 'Requested') {
        actions.push({ label: 'Propose Alternate', action: 'propose-time', variant: 'amber' });
      }
      actions.push({ label: 'Reject', action: 'reject-modal', variant: 'red' });
    } else if (session.status === 'Open' && session.session_type === 'group') {
      actions.push({ label: 'Start Class', action: 'start', variant: 'emerald' });
    } else if (session.status === 'Accepted') {
      const joinAllowed = canJoinSession(session);
      actions.push({
        label: joinAllowed ? 'Join Meeting' : `Join At ${formatJoinOpenAt(session)}`,
        action: 'join',
        variant: 'blue',
        disabled: !joinAllowed,
      });
      actions.push({ label: 'Mark Complete', action: 'complete', variant: 'slate' });
    }

    return actions;
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 shadow-sm">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Session Management</h1>
        <p className="text-lg text-slate-700 mt-2">Manage requests and publish open classes for students who want to join your topic sessions.</p>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Publish Open Class</h3>
        <p className="text-slate-600 mb-5">Announce: "Today at this time I am teaching this subject" so interested students can enroll.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={openClassDraft.subject_master_id}
            onChange={(e) => setOpenClassDraft((prev) => ({ ...prev, subject_master_id: e.target.value }))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Select Subject</option>
            {teacherSubjects.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.subject_name || entry.sub_id}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={openClassDraft.custom_start_at}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setOpenClassDraft((prev) => ({ ...prev, custom_start_at: e.target.value }))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={openClassDraft.duration_minutes}
            onChange={(e) => setOpenClassDraft((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
            <option value={120}>120 min</option>
          </select>

          <input
            type="number"
            min={2}
            max={100}
            value={openClassDraft.max_students}
            onChange={(e) => setOpenClassDraft((prev) => ({ ...prev, max_students: e.target.value }))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Seats"
          />

          <Button onClick={handlePublishOpenClass} loading={isPublishingClass}>
            Publish
          </Button>
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={openClassDraft.topic_description}
            onChange={(e) => setOpenClassDraft((prev) => ({ ...prev, topic_description: e.target.value }))}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Topic description (e.g., Differential Equations crash class)"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-700 text-base font-semibold">Pending Requests</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{requestedCount}</p>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </Card>

        <Card className="p-6 bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-700 text-base font-semibold">Accepted Sessions</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">{acceptedCount}</p>
            </div>
            <div className="text-3xl">✓</div>
          </div>
        </Card>

        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-700 text-base font-semibold">Completed</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{completedCount}</p>
            </div>
            <div className="text-3xl">✓✓</div>
          </div>
        </Card>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200 overflow-x-auto">
        {TAB_DEFINITIONS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 font-semibold text-base border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
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

      {loadError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-red-200 shadow-sm" role="alert">
          <h3 className="text-2xl font-bold text-red-700 mb-2">Unable to load sessions</h3>
          <p className="text-base text-slate-700 font-medium mb-5">{loadError}</p>
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
          {paginatedSessions.map((session) => {
            const statusConfig = getStatusConfig(session.status);
            const actions = getAvailableActions(session);

            return (
              <Card
                key={session.id}
                className={`overflow-hidden border-2 ${statusConfig.bgColor} ${
                  highlightedSessionId === session.id ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1 ${statusConfig.color}`}>
                          {statusConfig.icon} {session.status}
                        </span>
                        <span className="text-base font-medium text-slate-600">{formatSessionDate(session.session_date)}</span>
                      </div>

                      {session.status === 'Accepted' && (
                        <p className="mb-3 text-sm text-slate-600">
                          Join opens at <span className="font-semibold text-slate-800">{formatJoinOpenAt(session)}</span>
                          <span className="text-slate-500"> ({timezoneLabel})</span>
                        </p>
                      )}

                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {session.student_id && `Student: ${session.student_id}`}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-base">
                        <div>
                          <span className="text-slate-600">
                            <strong>Topic:</strong> {session.topic_description || 'Not specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">
                            <strong>Subject ID:</strong> {session.subject_master_id}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">
                            <strong>Type:</strong> {session.session_type || 'Individual'}
                          </span>
                        </div>
                        {session.max_students && (
                          <div>
                            <span className="text-slate-600">
                              <strong>Max Students:</strong> {session.max_students}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:w-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewDetails(session)}
                        className="w-full lg:w-auto"
                      >
                        View Details
                      </Button>
                      {actions.length > 0 ? (
                        actions.map((actionBtn) => {
                          const colorMap = {
                            blue: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
                            emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
                            amber: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
                            red: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
                            slate: 'bg-slate-600 hover:bg-slate-700 text-white focus:ring-slate-500',
                          };
                          return (
                            <button
                              key={actionBtn.action}
                              onClick={() => {
                                if (actionBtn.disabled) return;
                                if (actionBtn.action === 'reject-modal') {
                                  handleOpenRejectModal(session);
                                  return;
                                }
                                if (actionBtn.action === 'propose-time') {
                                  handleOpenProposeModal(session);
                                  return;
                                }
                                handleSessionAction(session.id, actionBtn.action);
                              }}
                              disabled={isActionLoading === session.id || actionBtn.disabled}
                              className={`px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${colorMap[actionBtn.variant]} w-full lg:w-auto`}
                            >
                              {isActionLoading === session.id ? (
                                <span className="flex items-center justify-center gap-2">
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Processing...
                                </span>
                              ) : (
                                actionBtn.label
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center py-2 text-slate-600 text-base">No actions available</div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

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
        isOpen={Boolean(rejectModalSession)}
        onClose={() => !isSubmittingModal && setRejectModalSession(null)}
        title="Reject Session Request"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setRejectModalSession(null)} disabled={isSubmittingModal}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReject} loading={isSubmittingModal}>
              Confirm Reject
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">This request will be marked as rejected and the student will be notified.</p>
      </Modal>

      <Modal
        isOpen={Boolean(proposeModalSession)}
        onClose={() => !isSubmittingModal && setProposeModalSession(null)}
        title="Propose Alternate Time"
        size="md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setProposeModalSession(null)} disabled={isSubmittingModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitProposedTime} loading={isSubmittingModal}>
              Send Proposal
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-slate-600">Select a new slot and date to propose an alternative session time.</p>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Alternate Slot</label>
            <select
              value={proposedSlotId}
              onChange={(e) => setProposedSlotId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
            >
              <option value="">Select slot</option>
              {availabilitySlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {`${String(slot.day_of_week || '').toUpperCase()} ${slot.start_time} - ${slot.end_time}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Alternate Date</label>
            <input
              type="date"
              value={proposedDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setProposedDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
            />
          </div>

          {proposeModalSession && (
            <div className="text-sm rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
              Current request: {formatSessionDate(proposeModalSession.session_date)}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(joinError)}
        onClose={() => setJoinError(null)}
        title="Unable to Join Meeting"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setJoinError(null)}>Close</Button>
            <Button variant="primary" onClick={() => handleSessionAction(joinError.sessionId, 'join')}>
              Retry
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">{joinError?.message}</p>
      </Modal>
    </div>
  );
}
