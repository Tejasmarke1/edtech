import React, { useRef } from 'react';
import useJitsiMeeting from '../hooks/useJitsiMeeting';
import Button from './ui/Button';

export default function JitsiMeeting({
  roomName,
  meetingLink,
  jwtToken,
  displayName,
  email,
  userRole,
  subject,
  onConferenceLeft,
  onError,
}) {
  const containerRef = useRef(null);

  const {
    isConnecting,
    isConnected,
    participantCount,
    participants,
    leaveMeeting,
    muteAll,
    removeParticipant,
  } = useJitsiMeeting({
    containerRef,
    roomName,
    meetingLink,
    jwtToken,
    displayName,
    email,
    userRole,
    onConferenceLeft,
    onError,
  });

  return (
    <div className="h-full min-h-[480px] flex flex-col rounded-2xl overflow-hidden border border-slate-300 bg-slate-950 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.8)]">
      <div className="px-4 py-3 bg-slate-900/95 text-slate-100 border-b border-slate-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
            <span className="inline-flex items-center rounded-full bg-red-500/20 text-red-200 px-2 py-0.5 font-semibold tracking-wide">LIVE</span>
            <span className="inline-flex items-center rounded-full bg-cyan-500/20 text-cyan-200 px-2 py-0.5 font-semibold tracking-wide">{userRole === 'teacher' ? 'TEACHER' : 'STUDENT'}</span>
            <span className="inline-flex items-center rounded-full bg-slate-700 text-slate-200 px-2 py-0.5 font-semibold tracking-wide">{participantCount} participants</span>
          </div>
          <p className="text-sm md:text-base font-semibold text-slate-100 truncate">{subject || 'Live Session'}</p>
          <p className="text-xs text-slate-400">{isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Waiting to connect'}</p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          {userRole === 'teacher' && (
            <Button variant="outline" size="sm" className="!border-slate-500 !text-slate-100 hover:!bg-slate-700" onClick={muteAll}>
              Mute All
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={leaveMeeting}>
            Leave
          </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-black min-h-0">
        <div ref={containerRef} className="h-full w-full" />
        {isConnecting && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/85 backdrop-blur-[2px]">
            <div className="text-center text-white px-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-blue-500 mx-auto mb-3" />
              <p className="font-medium">Connecting to meeting</p>
              <p className="text-sm text-slate-300 mt-1">Camera and microphone permissions may be requested.</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
          <div className="inline-flex items-center rounded-full bg-black/50 text-slate-100 border border-white/10 px-3 py-1.5 text-xs backdrop-blur-sm">
            Tip: Use fullscreen for better focus and visibility.
          </div>
        </div>
      </div>

      {userRole === 'teacher' && isConnected && participants.length > 0 && (
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Participant Controls</p>
            <p className="text-xs text-slate-500">Remove disruptive attendees if needed</p>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between text-sm text-slate-200 bg-slate-800 rounded-lg px-3 py-2">
                <span className="truncate pr-2">{participant.displayName}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="!text-red-300 hover:!bg-red-500/10"
                  onClick={() => removeParticipant(participant.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
