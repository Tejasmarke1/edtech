import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

/**
 * SessionJoin Component
 * Displays Jitsi Meet video conference interface for session participants
 */
export default function SessionJoin() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [meetingData, setMeetingData] = useState(null);
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  useEffect(() => {
    const fetchSessionAndJoin = async () => {
      try {
        // Get meeting link and JWT token
        const { data } = await apiClient.get(`/sessions/${sessionId}/join`);
        setMeetingData(data);

        // Extract room name from meeting link
        const roomName = data.room_name || data.meeting_link?.split('/').pop();
        
        if (jitsiContainerRef.current && window.JitsiMeetExternalAPI) {
          const domain = 'localhost:8080';
          const options = {
            roomName: roomName,
            width: '100%',
            height: '100%',
            parentNode: jitsiContainerRef.current,
            userInfo: {
              displayName: user?.name || user?.user_name || 'Student',
              email: user?.email,
            },
            jwt: data.jwt_token,
            configOverwrite: {
              startWithAudioMuted: true,
              startWithVideoMuted: false,
              disableSimulcast: false,
              enableWelcomePage: false,
            },
            interfaceConfigOverwrite: {
              DEFAULT_REMOTE_DISPLAY_NAME: 'Guest',
              DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
              SHOW_JITSI_WATERMARK: false,
            },
          };

          jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

          // Handle events
          jitsiApiRef.current.addEventListener('videoConferenceJoined', () => {
            console.log('User joined the video conference');
            toast.success('Connected to session');
          });

          jitsiApiRef.current.addEventListener('videoConferenceLocked', () => {
            console.log('Conference is now locked');
          });

          jitsiApiRef.current.addEventListener('videoConferenceLeft', () => {
            console.log('User left the conference');
            // Optionally mark session as completed or redirect
            handleSessionExit();
          });

          jitsiApiRef.current.addEventListener('displayNameChange', (event) => {
            console.log('Display name changed:', event.displayname);
          });

          jitsiApiRef.current.addEventListener('participantJoined', (event) => {
            console.log('Participant joined:', event);
          });

          jitsiApiRef.current.addEventListener('participantLeft', (event) => {
            console.log('Participant left:', event);
          });
        }
      } catch (error) {
        console.error('Failed to join session:', error);
        toast.error(error?.response?.data?.detail || 'Failed to join session. Please try again.');
        navigate(`/my-sessions`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionAndJoin();

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, [sessionId, user, navigate]);

  const handleSessionExit = async () => {
    try {
      // Optionally mark the session as completed
      // await apiClient.put(`/sessions/${sessionId}/complete`);
      toast.info('Session ended');
      setTimeout(() => navigate('/my-sessions'), 2000);
    } catch (error) {
      console.error('Error handling session exit:', error);
    }
  };

  const handleLeave = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('hangup');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Connecting to session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <h1 className="text-white font-semibold">Session Active</h1>
        </div>
        <button
          onClick={handleLeave}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Leave Session
        </button>
      </div>

      {/* Jitsi Container */}
      <div
        ref={jitsiContainerRef}
        className="flex-1"
        id="jitsi-container"
        style={{ width: '100%', height: 'calc(100% - 60px)' }}
      />

      {/* Footer */}
      <div className="bg-slate-900 border-t border-slate-700 px-6 py-4 text-sm text-slate-400 flex items-center justify-between">
        <span>Room: {meetingData?.room_name || 'Unknown'}</span>
        <span>You are {user?.role === 'teacher' ? 'Teaching' : 'Learning'}</span>
      </div>
    </div>
  );
}
