import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_JITSI_DOMAIN = 'meet.jit.si';
const DEFAULT_EXTERNAL_API = 'https://meet.jit.si/external_api.js';

function resolveRoomName(roomName, meetingLink) {
  if (roomName) return roomName;
  if (!meetingLink) return '';
  return meetingLink.split('/').filter(Boolean).pop() || '';
}

function resolveJitsiRuntimeConfig(meetingLink) {
  const envDomain = import.meta.env.VITE_JITSI_DOMAIN;
  const envExternalApi = import.meta.env.VITE_JITSI_EXTERNAL_API_URL;
  const envHttpPort = import.meta.env.VITE_JITSI_HTTP_PORT || '8080';

  if (envDomain || envExternalApi) {
    return {
      domain: envDomain || DEFAULT_JITSI_DOMAIN,
      externalApiUrl: envExternalApi || DEFAULT_EXTERNAL_API,
      noSSL: false,
    };
  }

  if (meetingLink) {
    try {
      const url = new URL(meetingLink);

      const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (import.meta.env.DEV && isLocalHost && url.protocol === 'https:') {
        const localHttpDomain = `${url.hostname}:${envHttpPort}`;
        return {
          domain: localHttpDomain,
          externalApiUrl: `http://${localHttpDomain}/external_api.js`,
          noSSL: true,
        };
      }

      if (url.protocol === 'http:') {
        return {
          domain: url.host,
          externalApiUrl: `${url.origin}/external_api.js`,
          noSSL: true,
        };
      }

      return {
        domain: url.host,
        externalApiUrl: `${url.origin}/external_api.js`,
        noSSL: false,
      };
    } catch {
      // Ignore parse failures and use safe defaults.
    }
  }

  return {
    domain: DEFAULT_JITSI_DOMAIN,
    externalApiUrl: DEFAULT_EXTERNAL_API,
    noSSL: false,
  };
}

function loadJitsiExternalApi(scriptUrl) {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const normalizedScriptUrl = new URL(scriptUrl, window.location.href).href;
    const existing = document.querySelector('script[data-jitsi-external-api="true"]');
    if (existing) {
      const existingSrc = existing.src;

      if (existingSrc === normalizedScriptUrl) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load Jitsi API script.')), { once: true });
        return;
      }

      existing.remove();
    }

    const script = document.createElement('script');
    script.src = normalizedScriptUrl;
    script.async = true;
    script.dataset.jitsiExternalApi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi API script.'));
    document.body.appendChild(script);
  });
}

function buildNoSslIframeUrl({ externalApiUrl, roomName, jwtToken }) {
  const origin = new URL(externalApiUrl, window.location.href).origin;
  const params = new URLSearchParams({ jwt: jwtToken });
  return `${origin}/${roomName}?${params.toString()}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=true`;
}

export default function useJitsiMeeting({
  containerRef,
  roomName,
  meetingLink,
  jwtToken,
  displayName,
  email,
  userRole,
  onConferenceLeft,
  onError,
}) {
  const apiRef = useRef(null);
  const participantsRef = useRef(new Map());

  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [participants, setParticipants] = useState([]);

  const effectiveRoom = useMemo(() => resolveRoomName(roomName, meetingLink), [roomName, meetingLink]);
  const jitsiConfig = useMemo(() => resolveJitsiRuntimeConfig(meetingLink), [meetingLink]);

  const safeSetParticipants = useCallback(() => {
    setParticipants(Array.from(participantsRef.current.values()));
    setParticipantCount(Math.max(1, participantsRef.current.size + 1));
  }, []);

  useEffect(() => {
    if (!containerRef?.current || !effectiveRoom || !jwtToken) return;

    let mounted = true;

    const bootstrap = async () => {
      try {
        setIsConnecting(true);

        if (jitsiConfig.noSSL) {
          const iframe = document.createElement('iframe');
          iframe.src = buildNoSslIframeUrl({
            externalApiUrl: jitsiConfig.externalApiUrl,
            roomName: effectiveRoom,
            jwtToken,
          });
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = '0';
          iframe.allow = 'camera; microphone; fullscreen; display-capture; autoplay';

          const container = containerRef.current;
          container.innerHTML = '';
          container.appendChild(iframe);

          iframe.addEventListener('load', () => {
            if (!mounted) return;
            setIsConnected(true);
            setIsConnecting(false);
          });

          return;
        }

        await loadJitsiExternalApi(jitsiConfig.externalApiUrl);

        if (!mounted || !window.JitsiMeetExternalAPI) return;

        const options = {
          roomName: effectiveRoom,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          noSSL: jitsiConfig.noSSL,
          jwt: jwtToken,
          userInfo: {
            displayName: displayName || 'Guest',
            email: email || '',
          },
          configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableWelcomePage: false,
            // Local non-SSL setups frequently fail bridge websocket TLS;
            // force datachannel transport to keep conference stable in dev.
            openBridgeChannel: jitsiConfig.noSSL ? 'datachannel' : 'websocket',
            ...(jitsiConfig.noSSL
              ? {
                  websocket: `ws://${jitsiConfig.domain}/xmpp-websocket`,
                  bosh: `http://${jitsiConfig.domain}/http-bind`,
                }
              : {}),
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'chat',
              'desktop',
              'fullscreen',
              'hangup',
              'participants-pane',
            ],
          },
        };

        const api = new window.JitsiMeetExternalAPI(jitsiConfig.domain, options);
        apiRef.current = api;

        api.addEventListener('videoConferenceJoined', () => {
          if (!mounted) return;
          setIsConnected(true);
          setIsConnecting(false);
        });

        api.addEventListener('participantJoined', (event) => {
          participantsRef.current.set(event.id, {
            id: event.id,
            displayName: event.displayName || 'Participant',
          });
          safeSetParticipants();
        });

        api.addEventListener('participantLeft', (event) => {
          participantsRef.current.delete(event.id);
          safeSetParticipants();
        });

        api.addEventListener('videoConferenceLeft', () => {
          setIsConnected(false);
          setIsConnecting(false);
          onConferenceLeft?.();
        });

        api.addEventListener('conferenceFailed', (event) => {
          if (!mounted) return;
          setIsConnected(false);
          setIsConnecting(false);
          onError?.(new Error(event?.name || 'Jitsi conference failed'));
        });

        api.addEventListener('readyToClose', () => {
          setIsConnected(false);
          setIsConnecting(false);
          onConferenceLeft?.();
        });
      } catch (error) {
        if (!mounted) return;
        setIsConnecting(false);
        setIsConnected(false);
        onError?.(error);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      participantsRef.current.clear();
    };
  }, [containerRef, effectiveRoom, jwtToken, displayName, email, onConferenceLeft, onError, safeSetParticipants, jitsiConfig]);

  const leaveMeeting = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.executeCommand('hangup');
      return;
    }

    setIsConnected(false);
    setIsConnecting(false);
    onConferenceLeft?.();
  }, [onConferenceLeft]);

  const muteAll = useCallback(() => {
    if (userRole !== 'teacher') return;
    apiRef.current?.executeCommand('muteEveryone');
  }, [userRole]);

  const removeParticipant = useCallback((participantId) => {
    if (userRole !== 'teacher' || !participantId) return;
    apiRef.current?.executeCommand('kickParticipant', participantId);
  }, [userRole]);

  return {
    apiRef,
    isConnecting,
    isConnected,
    participantCount,
    participants,
    leaveMeeting,
    muteAll,
    removeParticipant,
  };
}
