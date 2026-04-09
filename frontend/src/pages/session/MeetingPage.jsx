import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import JitsiMeeting from '../../components/JitsiMeeting';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/modals/Modal';

function getApiErrorMessage(error, fallbackMessage) {
  const status = error?.response?.status;
  if (status === 401) return 'Your session expired. Please log in again.';
  if (status === 403) return "You don't have access to join this meeting.";
  if (status === 404) return 'Meeting not found. The session may have changed.';
  if (status >= 500) return 'Server error while preparing the meeting. Please retry.';
  return error?.response?.data?.detail || fallbackMessage;
}

function getDefaultBackPath(role) {
  return role === 'teacher' ? '/teacher-sessions' : '/my-sessions';
}

function getSessionDetailPath(role, sessionId) {
  return role === 'teacher' ? `/teacher/sessions/${sessionId}` : `/sessions/${sessionId}`;
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MeetingPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [meetingPayload, setMeetingPayload] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [meetingError, setMeetingError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const hasHandledRemoteEndRef = useRef(false);

  const userRole = user?.role || location.state?.userRole || 'student';

  const subject = useMemo(() => {
    return (
      location.state?.subject ||
      sessionSummary?.subject_name ||
      sessionSummary?.subject_master_id ||
      sessionSummary?.topic_description ||
      'Live Session'
    );
  }, [location.state, sessionSummary]);

  const teacherName = useMemo(() => {
    return sessionSummary?.teacher_name || sessionSummary?.teacher_id || 'Teacher';
  }, [sessionSummary]);

  const startsAtLabel = useMemo(() => {
    return formatDateTime(sessionSummary?.slot_start_time || sessionSummary?.scheduled_at);
  }, [sessionSummary]);

  const durationLabel = useMemo(() => {
    const minutes = Number(sessionSummary?.duration_minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    return `${minutes} min`;
  }, [sessionSummary]);

  const loadMeeting = async () => {
    setIsLoading(true);
    setMeetingError('');

    try {
      const fromState = location.state?.roomName && location.state?.jwtToken;

      if (fromState) {
        setMeetingPayload({
          room_name: location.state.roomName,
          jwt_token: location.state.jwtToken,
          meeting_link: location.state.meetingLink,
        });
      } else {
        try {
          await apiClient.post(`/sessions/${sessionId}/create-room`);
        } catch {
          // Room creation is optional for some backends; ignore and continue.
        }

        const { data } = await apiClient.get(`/sessions/${sessionId}/join`);
        setMeetingPayload(data);
      }

      try {
        const { data: sessionData } = await apiClient.get(`/sessions/${sessionId}`);
        setSessionSummary(sessionData);
      } catch {
        setSessionSummary(null);
      }
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to initialize meeting.');
      setMeetingError(message);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMeeting();
  }, [sessionId]);

  useEffect(() => {
    if (!meetingPayload?.jwt_token || hasHandledRemoteEndRef.current) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const { data } = await apiClient.get('/sessions/my?skip=0&limit=100');
        const items = data.items || (Array.isArray(data) ? data : []);
        const current = items.find((item) => item.id === sessionId);
        if (!current) return;

        if (['Completed', 'Cancelled', 'Rejected'].includes(current.status)) {
          hasHandledRemoteEndRef.current = true;
          toast('Session was ended by teacher.', { icon: 'ℹ️' });
          navigate(getDefaultBackPath(userRole));
        }
      } catch {
        // Silent polling; avoid interrupting active meeting for transient errors.
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [meetingPayload, navigate, sessionId, userRole]);

  const handleLeave = () => {
    toast.success('Session ended');
    navigate(getDefaultBackPath(userRole));
  };

  const handleMeetingError = (error) => {
    const message = getApiErrorMessage(error, 'Unable to connect to Jitsi meeting.');
    setMeetingError(message);
    setShowErrorModal(true);
  };

  const handleEndSession = async () => {
    setIsEndingSession(true);
    try {
      await apiClient.put(`/sessions/${sessionId}/complete`);
      toast.success('Session marked as completed.');
      navigate(getDefaultBackPath(userRole));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to end session.'));
    } finally {
      setIsEndingSession(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-slate-100 p-6 md:p-10 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-11 w-11 border-4 border-slate-200 border-t-blue-600 mx-auto mb-4" />
          <p className="text-slate-900 font-semibold">Preparing your meeting room</p>
          <p className="text-slate-600 text-sm mt-1">We are securely connecting audio, video, and session controls.</p>
        </div>
      </div>
    );
  }

  if (!meetingPayload?.jwt_token || !(meetingPayload?.room_name || meetingPayload?.meeting_link)) {
    return (
      <Card className="max-w-3xl mx-auto text-center border border-slate-200 shadow-sm rounded-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Meeting not available</h2>
        <p className="text-slate-600 mb-6">{meetingError || 'Could not retrieve meeting credentials.'}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(getSessionDetailPath(userRole, sessionId))}>Back to Session</Button>
          <Button variant="primary" onClick={loadMeeting}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-7.5rem)] min-h-[640px] flex flex-col gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-100/70 p-3 md:p-4">
      <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">Live Session</span>
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
                {userRole === 'teacher' ? 'Teacher Console' : 'Student View'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{subject}</h1>
            <p className="text-sm text-slate-600 mt-1">{userRole === 'teacher' ? 'You are in control of class delivery and participant moderation.' : 'You are connected to your live class. Keep this tab active for best quality.'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto lg:min-w-[300px]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Teacher</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{teacherName}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Starts</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{startsAtLabel || 'Live now'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Session Details</p>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {durationLabel ? `Duration ${durationLabel}` : 'Duration not specified'}
                {sessionSummary?.session_type ? ` | ${sessionSummary.session_type}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-500">
            Tip: {userRole === 'teacher' ? 'Use Mute All and participant controls for classroom discipline.' : 'Use headphones for clear audio and lower echo.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate(getSessionDetailPath(userRole, sessionId))}>Session Detail</Button>
            <Button variant="ghost" onClick={() => navigate(getDefaultBackPath(userRole))}>Back to Sessions</Button>
            {userRole === 'teacher' && (
              <Button variant="danger" onClick={handleEndSession} loading={isEndingSession}>End Session</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <JitsiMeeting
          roomName={meetingPayload.room_name}
          meetingLink={meetingPayload.meeting_link}
          jwtToken={meetingPayload.jwt_token}
          displayName={user?.name || user?.user_name || 'Guest'}
          email={user?.email || ''}
          userRole={userRole}
          subject={subject}
          onConferenceLeft={handleLeave}
          onError={handleMeetingError}
        />
      </div>

      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Unable to Start Meeting"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => navigate(getSessionDetailPath(userRole, sessionId))}>Back to Session</Button>
            <Button
              variant="primary"
              onClick={async () => {
                setShowErrorModal(false);
                await loadMeeting();
              }}
            >
              Retry
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">{meetingError || 'Something went wrong while initializing the meeting.'}</p>
      </Modal>
    </div>
  );
}
