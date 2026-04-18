# Issue Register

This file tracks recurring and resolved issues found during development/testing.

## How To Use

1. Add new issues at the top of the table.
2. Keep status updated: Open, In Progress, Resolved.
3. For each resolved issue, include regression test coverage or manual validation steps.
4. Link exact source files changed.

## Current Issues

| ID | Area | Issue | Impact | Status | Root Cause | Fix Summary | Key Files | Validation |
|---|---|---|---|---|---|---|---|---|
| ISS-001 | Student Sessions | Accepted sessions not visible in Upcoming tab | Students miss valid upcoming classes | Resolved | Frontend tab classification and date filter excluded accepted group sessions / today sessions | Updated status categorization and upcoming date filter logic | frontend/src/pages/student/MySessions.jsx | Manual UI check on My Sessions + upcoming filter behavior |
| ISS-002 | Booking Validation | Session could be requested with slot day and selected date mismatch | Invalid bookings and confusion for student/teacher | Resolved | Missing backend weekday validation between slot.day_of_week and session_date | Added backend guard + frontend pre-submit check with clear error prompt | app/services/session_service.py, frontend/src/components/modals/BookingModal.jsx, tests/test_api.py | pytest: session booking mismatch and booking flow checks |
| ISS-003 | Jitsi Script Loading | App attempted to load external_api.js from localhost:8080 unexpectedly | Join failures in hosted mode | Resolved | Hardcoded script source and legacy local assumptions | Removed hardcoded script include and unified dynamic script resolution | frontend/index.html, frontend/src/pages/session/SessionJoin.jsx | Browser console no longer shows localhost:8080 script refusal |
| ISS-004 | Meeting Join UI | Meeting stuck on connecting due to overlay behavior | User could not interact with underlying join UI | Resolved | Overlay blocked interaction and connection state timing was brittle | Made overlay non-blocking and improved connection state transitions | frontend/src/components/JitsiMeeting.jsx, frontend/src/hooks/useJitsiMeeting.js | Manual join flow from teacher and student |
| ISS-005 | Jitsi Moderator Role | Teacher not recognized as moderator in public hosted mode | Session did not start reliably for participants | Resolved | Public host mode token rules differ from self-hosted JWT auth expectations | Switched runtime to self-hosted JWT mode when moderator control is required | .env, .env.example, app/utils/jitsi.py | Join payload check: teacher moderator claim true |
| ISS-006 | Media Reconnect Loop | "Disconnected/Rejoin" popup during active meeting | Unstable calls, frequent reconnect | Resolved | JVB advertised IP did not match local browser routing path | Forced JVB advertise IP and recreated JVB container with verified env | .env, docker-compose.yml | JVB logs show publicAddress aligned with local route |
| ISS-007 | Payment/Sessions List Noise | Client saw 422/404 noise around list limits and summary fetch | Unnecessary UI errors and confusion | Resolved | Frontend list limits/endpoints not aligned with backend expectations | Updated affected endpoints/limits and fallback fetch paths | frontend/src/pages/session/SessionDetail.jsx, frontend/src/pages/student/Payments.jsx, frontend/src/pages/session/MeetingPage.jsx | Manual navigation across sessions/payments pages |

## Regression Checklist

- Sessions
  - Accepted individual sessions appear in Upcoming tab.
  - Accepted group sessions are categorized as intended by product rules.
  - Upcoming tab includes same-day accepted sessions.
- Booking
  - Slot day and selected date must match.
  - Student sees clear prompt to pick the correct date.
- Meetings
  - Teacher token has moderator=true in self-hosted JWT mode.
  - Student token has moderator=false.
  - No forced fallback to incorrect external_api.js host.
  - JVB advertised IP matches environment (local loopback for same-machine testing).
- UX/Error Handling
  - No blocking overlay prevents join actions.
  - Error messages are user-readable and actionable.

## Suggested New Tests

1. API test for slot day/date mismatch rejection (already added in tests/test_api.py).
2. Frontend test for My Sessions upcoming tab visibility with accepted sessions.
3. Browser join smoke test verifying teacher enters first and student joins same room.
4. Config sanity test for Jitsi mode (public vs self-hosted JWT) before runtime.
