"""Comprehensive API tests for all implemented endpoints.

Covers: Auth, Teacher, Student, Search, Sessions, Notifications, Ratings.
"""

import hashlib
import hmac
import json
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.models.subject import Subject
from app.utils.security import create_access_token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _auth_header(user_name: str, role: str = "teacher") -> dict:
    """Return an Authorization header with a valid JWT for the given user."""
    token = create_access_token({"sub": user_name, "role": role})
    return {"Authorization": f"Bearer {token}"}


def _seed_subject(db: Session, sub_id: str = "math101", name: str = "Mathematics"):
    subj = Subject(sub_id=sub_id, name=name)
    db.add(subj)
    db.commit()
    return subj


def _register(client: TestClient, email: str, role: str, full_name: str = "Test User"):
    """Register a user."""
    return client.post(
        "/api/v1/auth/register",
        json={
            "user_name": email,
            "password": "Str0ngP@ss!",
            "role": role,
            "full_name": full_name,
        },
    )


def _login(client: TestClient, email: str):
    """Login and return (access_token, refresh_token)."""
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Str0ngP@ss!"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["access_token"], body["refresh_token"]


def _webhook_signature(raw_body: bytes) -> str:
    secret = settings.PAYMENT_WEBHOOK_SECRET or settings.SECRET_KEY
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def _raw_json(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


# ===================================================================
# 1. HEALTH CHECK
# ===================================================================
class TestHealth:
    def test_health(self, client: TestClient):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


# ===================================================================
# 2. AUTH
# ===================================================================
class TestAuth:
    def test_register_teacher(self, client: TestClient):
        r = _register(client, "teacher@example.com", "teacher", "Jane Doe")
        assert r.status_code == 201
        body = r.json()
        assert body["user_name"] == "teacher@example.com"
        assert body["role"] == "teacher"

    def test_register_student(self, client: TestClient):
        r = _register(client, "student@example.com", "student")
        assert r.status_code == 201
        assert r.json()["role"] == "student"

    def test_register_duplicate(self, client: TestClient):
        _register(client, "dup@example.com", "student")
        r = _register(client, "dup@example.com", "student")
        assert r.status_code == 409

    def test_login(self, client: TestClient):
        _register(client, "login@example.com", "teacher")
        r = client.post(
            "/api/v1/auth/login",
            data={"username": "login@example.com", "password": "Str0ngP@ss!"},
        )
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client: TestClient):
        _register(client, "wrong@example.com", "teacher")
        r = client.post(
            "/api/v1/auth/login",
            data={"username": "wrong@example.com", "password": "BadPassword!"},
        )
        assert r.status_code == 401

    def test_me(self, client: TestClient):
        _register(client, "me@example.com", "student")
        headers = _auth_header("me@example.com", "student")
        r = client.get("/api/v1/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["user_name"] == "me@example.com"

    def test_me_unauthorized(self, client: TestClient):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401


# ===================================================================
# 3. TEACHER MODULE
# ===================================================================
class TestTeacher:
    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session):
        _register(client, "teach@example.com", "teacher", "Professor X")
        self.headers = _auth_header("teach@example.com", "teacher")
        _seed_subject(db_session, "math101", "Mathematics")
        _seed_subject(db_session, "phy101", "Physics")

    # ---- Profile ----
    def test_get_profile(self, client: TestClient):
        r = client.get("/api/v1/teachers/profile", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["user_name"] == "teach@example.com"

    def test_update_profile(self, client: TestClient):
        r = client.put(
            "/api/v1/teachers/profile",
            headers=self.headers,
            json={"bio": "I love math", "per_30_mins_charges": 500},
        )
        assert r.status_code == 200
        assert r.json()["bio"] == "I love math"
        assert r.json()["per_30_mins_charges"] == 500

    # ---- Subjects ----
    def test_add_and_get_subjects(self, client: TestClient):
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.headers,
            json={"sub_id": "math101"},
        )
        assert r.status_code == 201
        assert r.json()["sub_id"] == "math101"

        r = client.get("/api/v1/teachers/subjects", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_remove_subject(self, client: TestClient):
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.headers,
            json={"sub_id": "math101"},
        )
        entry_id = r.json()["id"]
        r = client.delete(
            f"/api/v1/teachers/subjects/{entry_id}", headers=self.headers
        )
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_add_subject_not_found(self, client: TestClient):
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.headers,
            json={"sub_id": "nosuch"},
        )
        assert r.status_code == 404

    # ---- Videos ----
    def test_add_and_get_videos(self, client: TestClient):
        client.post(
            "/api/v1/teachers/subjects",
            headers=self.headers,
            json={"sub_id": "math101"},
        )
        r = client.post(
            "/api/v1/teachers/subjects/math101/videos",
            headers=self.headers,
            json={"video_url": "https://example.com/vid.mp4", "duration_seconds": 300},
        )
        assert r.status_code == 201

        r = client.get(
            "/api/v1/teachers/subjects/math101/videos", headers=self.headers
        )
        assert r.status_code == 200
        assert len(r.json()) == 1

    # ---- Availability ----
    def test_availability_crud(self, client: TestClient):
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.headers,
            json={"day_of_week": "mon", "start_time": "10:00", "end_time": "10:30"},
        )
        assert r.status_code == 201
        slot_id = r.json()["id"]

        r = client.get("/api/v1/teachers/availability", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["total"] >= 1

        r = client.put(
            f"/api/v1/teachers/availability/{slot_id}",
            headers=self.headers,
            json={"end_time": "11:00"},
        )
        assert r.status_code == 200
        assert r.json()["end_time"] == "11:00"

        r = client.delete(
            f"/api/v1/teachers/availability/{slot_id}", headers=self.headers
        )
        assert r.status_code == 204

    # ---- Earnings ----
    def test_earnings(self, client: TestClient):
        r = client.get("/api/v1/teachers/earnings", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["current_balance"] == 0

    # ---- Withdrawals ----
    def test_withdrawals_empty(self, client: TestClient):
        r = client.get("/api/v1/teachers/withdrawals", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["total"] == 0

    # ---- Student cannot access teacher endpoints ----
    def test_student_forbidden(self, client: TestClient):
        _register(client, "stu@example.com", "student")
        headers = _auth_header("stu@example.com", "student")
        r = client.get("/api/v1/teachers/profile", headers=headers)
        assert r.status_code == 403


# ===================================================================
# 4. STUDENT MODULE
# ===================================================================
class TestStudent:
    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient):
        _register(client, "stu1@example.com", "student", "Alice")
        self.headers = _auth_header("stu1@example.com", "student")

    def test_get_profile(self, client: TestClient):
        r = client.get("/api/v1/students/profile", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["user_name"] == "stu1@example.com"

    def test_update_profile(self, client: TestClient):
        r = client.put(
            "/api/v1/students/profile",
            headers=self.headers,
            json={"full_name": "Alice Updated", "gender": "female"},
        )
        assert r.status_code == 200
        assert r.json()["full_name"] == "Alice Updated"

    def test_teacher_forbidden(self, client: TestClient):
        _register(client, "teach2@example.com", "teacher")
        headers = _auth_header("teach2@example.com", "teacher")
        r = client.get("/api/v1/students/profile", headers=headers)
        assert r.status_code == 403


# ===================================================================
# 5. SEARCH
# ===================================================================
class TestSearch:
    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session):
        # Create teacher with subject
        _register(client, "t_search@example.com", "teacher", "Search Teacher")
        _seed_subject(db_session, "eng101", "English")
        t_headers = _auth_header("t_search@example.com", "teacher")
        client.post(
            "/api/v1/teachers/subjects", headers=t_headers, json={"sub_id": "eng101"}
        )
        # Create student for searching
        _register(client, "s_search@example.com", "student")
        self.headers = _auth_header("s_search@example.com", "student")

    def test_search_teachers(self, client: TestClient):
        r = client.get(
            "/api/v1/search", headers=self.headers, params={"topic": "English"}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        assert body["items"][0]["user_name"] == "t_search@example.com"

    def test_search_no_results(self, client: TestClient):
        r = client.get(
            "/api/v1/search", headers=self.headers, params={"topic": "Klingon"}
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_search_requires_topic(self, client: TestClient):
        r = client.get("/api/v1/search", headers=self.headers)
        assert r.status_code == 422

    def test_teacher_detail(self, client: TestClient):
        r = client.get(
            "/api/v1/search/teachers/t_search@example.com/detail",
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["user_name"] == "t_search@example.com"

    def test_teacher_detail_not_found(self, client: TestClient):
        r = client.get(
            "/api/v1/search/teachers/nobody@example.com/detail",
            headers=self.headers,
        )
        assert r.status_code == 404


# ===================================================================
# 6. SESSION SCHEDULING
# ===================================================================
class TestSessions:
    """Full session lifecycle: request → accept → complete."""

    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session):
        # Teacher
        _register(client, "sess_t@example.com", "teacher", "Teacher S")
        self.t_headers = _auth_header("sess_t@example.com", "teacher")
        # Set charges
        client.put(
            "/api/v1/teachers/profile",
            headers=self.t_headers,
            json={"per_30_mins_charges": 200},
        )
        # Subject
        _seed_subject(db_session, "sci101", "Science")
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.t_headers,
            json={"sub_id": "sci101"},
        )
        self.subject_entry_id = r.json()["id"]
        # Availability slot
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "tue", "start_time": "14:00", "end_time": "14:30"},
        )
        self.slot_id = r.json()["id"]
        # Student
        _register(client, "sess_s@example.com", "student", "Student S")
        self.s_headers = _auth_header("sess_s@example.com", "student")

    def _request_session(self, client: TestClient) -> dict:
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "sess_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
                "topic_description": "Help with gravity",
            },
        )
        assert r.status_code == 201, r.text
        return r.json()

    def test_request_session(self, client: TestClient):
        body = self._request_session(client)
        assert body["status"] == "Requested"
        assert body["student_id"] == "sess_s@example.com"
        assert body["meeting_link"] is not None

    def test_my_sessions(self, client: TestClient):
        self._request_session(client)
        # Student view
        r = client.get("/api/v1/sessions/my", headers=self.s_headers)
        assert r.status_code == 200
        assert r.json()["total"] == 1
        # Teacher view
        r = client.get("/api/v1/sessions/my", headers=self.t_headers)
        assert r.json()["total"] == 1

    def test_my_sessions_filter_status(self, client: TestClient):
        self._request_session(client)
        r = client.get(
            "/api/v1/sessions/my",
            headers=self.s_headers,
            params={"status": "Requested"},
        )
        assert r.json()["total"] == 1
        r = client.get(
            "/api/v1/sessions/my",
            headers=self.s_headers,
            params={"status": "Completed"},
        )
        assert r.json()["total"] == 0

    def test_accept_session(self, client: TestClient):
        session = self._request_session(client)
        r = client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.t_headers
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Accepted"

    def test_reject_session(self, client: TestClient):
        session = self._request_session(client)
        r = client.put(
            f"/api/v1/sessions/{session['id']}/reject", headers=self.t_headers
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Rejected"

    def test_propose_time(self, client: TestClient):
        session = self._request_session(client)
        # Create another slot
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "wed", "start_time": "15:00", "end_time": "15:30"},
        )
        new_slot_id = r.json()["id"]
        r = client.put(
            f"/api/v1/sessions/{session['id']}/propose-time",
            headers=self.t_headers,
            json={
                "slot_id": new_slot_id,
                "session_date": str(date.today() + timedelta(days=2)),
            },
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Rescheduled"

    def test_accept_substitute(self, client: TestClient):
        session = self._request_session(client)
        # Teacher proposes
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "thu", "start_time": "16:00", "end_time": "16:30"},
        )
        new_slot = r.json()["id"]
        client.put(
            f"/api/v1/sessions/{session['id']}/propose-time",
            headers=self.t_headers,
            json={
                "slot_id": new_slot,
                "session_date": str(date.today() + timedelta(days=3)),
            },
        )
        # Student accepts substitute
        r = client.put(
            f"/api/v1/sessions/{session['id']}/accept-substitute",
            headers=self.s_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Accepted"

    def test_reject_substitute(self, client: TestClient):
        session = self._request_session(client)
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "fri", "start_time": "09:00", "end_time": "09:30"},
        )
        new_slot = r.json()["id"]
        client.put(
            f"/api/v1/sessions/{session['id']}/propose-time",
            headers=self.t_headers,
            json={
                "slot_id": new_slot,
                "session_date": str(date.today() + timedelta(days=4)),
            },
        )
        r = client.put(
            f"/api/v1/sessions/{session['id']}/reject-substitute",
            headers=self.s_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Cancelled"

    def test_join_session(self, client: TestClient):
        session = self._request_session(client)
        client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.t_headers
        )
        r = client.get(
            f"/api/v1/sessions/{session['id']}/join", headers=self.s_headers
        )
        assert r.status_code == 200
        body = r.json()
        assert "meeting_link" in body
        assert "jwt_token" in body
        assert "room_name" in body

    def test_join_before_accept_fails(self, client: TestClient):
        session = self._request_session(client)
        r = client.get(
            f"/api/v1/sessions/{session['id']}/join", headers=self.s_headers
        )
        assert r.status_code == 400

    def test_complete_session_and_payment(self, client: TestClient):
        session = self._request_session(client)
        client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.t_headers
        )
        r = client.put(
            f"/api/v1/sessions/{session['id']}/complete", headers=self.t_headers
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Completed"

        # Wallet is not credited on completion; payment capture does that.
        r = client.get("/api/v1/teachers/earnings", headers=self.t_headers)
        assert r.json()["total_earned"] == 0
        assert r.json()["current_balance"] == 0

    def test_invalid_state_transitions(self, client: TestClient):
        session = self._request_session(client)
        # Can't complete a non-accepted session
        r = client.put(
            f"/api/v1/sessions/{session['id']}/complete", headers=self.t_headers
        )
        assert r.status_code == 400

        # Accept, then can't reject
        client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.t_headers
        )
        r = client.put(
            f"/api/v1/sessions/{session['id']}/reject", headers=self.t_headers
        )
        assert r.status_code == 400

    def test_student_cannot_accept(self, client: TestClient):
        session = self._request_session(client)
        r = client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.s_headers
        )
        assert r.status_code == 403

    def test_request_invalid_teacher(self, client: TestClient):
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "nobody@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
            },
        )
        assert r.status_code == 404

    # ---- Past date booking prevention ----
    def test_request_past_date_rejected(self, client: TestClient):
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "sess_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() - timedelta(days=1)),
            },
        )
        assert r.status_code == 422

    # ---- Double booking prevention ----
    def test_double_booking_prevented(self, client: TestClient):
        future = str(date.today() + timedelta(days=1))
        # First booking succeeds
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "sess_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": future,
            },
        )
        assert r.status_code == 201
        # Same teacher + slot + date → blocked
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "sess_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": future,
            },
        )
        assert r.status_code == 400

    def test_booking_allowed_after_cancellation(self, client: TestClient):
        """After a student cancels, the same slot+date can be booked again."""
        future = str(date.today() + timedelta(days=1))
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "sess_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": future,
            },
        )
        session_id = r.json()["id"]
        # Cancel
        r = client.put(
            f"/api/v1/sessions/{session_id}/cancel", headers=self.s_headers
        )
        assert r.status_code == 200
        # Re-book same slot + date
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "sess_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": future,
            },
        )
        assert r.status_code == 201

    # ---- Student cancellation ----
    def test_cancel_requested_session(self, client: TestClient):
        session = self._request_session(client)
        r = client.put(
            f"/api/v1/sessions/{session['id']}/cancel", headers=self.s_headers
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Cancelled"

    def test_cancel_rescheduled_session(self, client: TestClient):
        session = self._request_session(client)
        # Teacher proposes new time
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "sat", "start_time": "17:00", "end_time": "17:30"},
        )
        new_slot = r.json()["id"]
        client.put(
            f"/api/v1/sessions/{session['id']}/propose-time",
            headers=self.t_headers,
            json={
                "slot_id": new_slot,
                "session_date": str(date.today() + timedelta(days=3)),
            },
        )
        # Student cancels the rescheduled session
        r = client.put(
            f"/api/v1/sessions/{session['id']}/cancel", headers=self.s_headers
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Cancelled"

    def test_cannot_cancel_accepted_session(self, client: TestClient):
        session = self._request_session(client)
        client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.t_headers
        )
        r = client.put(
            f"/api/v1/sessions/{session['id']}/cancel", headers=self.s_headers
        )
        assert r.status_code == 400

    def test_teacher_cannot_cancel(self, client: TestClient):
        session = self._request_session(client)
        r = client.put(
            f"/api/v1/sessions/{session['id']}/cancel", headers=self.t_headers
        )
        assert r.status_code == 403

    # ---- Propose-time past date prevention ----
    def test_propose_time_past_date_rejected(self, client: TestClient):
        session = self._request_session(client)
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "sun", "start_time": "09:00", "end_time": "09:30"},
        )
        new_slot = r.json()["id"]
        r = client.put(
            f"/api/v1/sessions/{session['id']}/propose-time",
            headers=self.t_headers,
            json={
                "slot_id": new_slot,
                "session_date": str(date.today() - timedelta(days=1)),
            },
        )
        assert r.status_code == 422


# ===================================================================
# 6b. JITSI INTEGRATION (create-room, join with JWT)
# ===================================================================
class TestJitsiIntegration:
    """Jitsi room creation and JWT-based join flow."""

    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session):
        _register(client, "jitsi_t@example.com", "teacher", "Jitsi Teacher")
        self.t_headers = _auth_header("jitsi_t@example.com", "teacher")
        client.put(
            "/api/v1/teachers/profile",
            headers=self.t_headers,
            json={"per_30_mins_charges": 150},
        )
        _seed_subject(db_session, "jitsi_sub", "Jitsi Subject")
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.t_headers,
            json={"sub_id": "jitsi_sub"},
        )
        self.subject_entry_id = r.json()["id"]
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "mon", "start_time": "10:00", "end_time": "10:30"},
        )
        self.slot_id = r.json()["id"]
        _register(client, "jitsi_s@example.com", "student", "Jitsi Student")
        self.s_headers = _auth_header("jitsi_s@example.com", "student")

    def _create_accepted_session(self, client: TestClient) -> dict:
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "jitsi_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
                "topic_description": "Jitsi test topic",
            },
        )
        assert r.status_code == 201
        session = r.json()
        client.put(
            f"/api/v1/sessions/{session['id']}/accept", headers=self.t_headers
        )
        return session

    def test_create_room(self, client: TestClient):
        session = self._create_accepted_session(client)
        r = client.post(
            f"/api/v1/sessions/{session['id']}/create-room", headers=self.t_headers
        )
        assert r.status_code == 201
        body = r.json()
        assert body["session_id"] == session["id"]
        assert body["meeting_link"].startswith("https://meet.jit.si/")
        assert len(body["room_name"]) == 12
        assert body["jwt_token"]

    def test_create_room_student(self, client: TestClient):
        session = self._create_accepted_session(client)
        r = client.post(
            f"/api/v1/sessions/{session['id']}/create-room", headers=self.s_headers
        )
        assert r.status_code == 201
        assert r.json()["jwt_token"]

    def test_create_room_before_accept_fails(self, client: TestClient):
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "jitsi_t@example.com",
                "subject_master_id": self.subject_entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() + timedelta(days=2)),
            },
        )
        session_id = r.json()["id"]
        r = client.post(
            f"/api/v1/sessions/{session_id}/create-room", headers=self.t_headers
        )
        assert r.status_code == 400

    def test_join_returns_jwt_for_teacher(self, client: TestClient):
        session = self._create_accepted_session(client)
        r = client.get(
            f"/api/v1/sessions/{session['id']}/join", headers=self.t_headers
        )
        assert r.status_code == 200
        body = r.json()
        assert body["jwt_token"]
        assert body["room_name"]

    def test_join_returns_jwt_for_student(self, client: TestClient):
        session = self._create_accepted_session(client)
        r = client.get(
            f"/api/v1/sessions/{session['id']}/join", headers=self.s_headers
        )
        assert r.status_code == 200
        body = r.json()
        assert body["jwt_token"]
        assert body["room_name"]

    def test_non_participant_cannot_join(self, client: TestClient):
        session = self._create_accepted_session(client)
        _register(client, "outsider@example.com", "student", "Outsider")
        outsider_headers = _auth_header("outsider@example.com", "student")
        r = client.get(
            f"/api/v1/sessions/{session['id']}/join", headers=outsider_headers
        )
        assert r.status_code == 404

    def test_non_participant_cannot_create_room(self, client: TestClient):
        session = self._create_accepted_session(client)
        _register(client, "outsider2@example.com", "teacher", "Outsider T")
        outsider_headers = _auth_header("outsider2@example.com", "teacher")
        r = client.post(
            f"/api/v1/sessions/{session['id']}/create-room", headers=outsider_headers
        )
        assert r.status_code == 404


# ===================================================================
# 7. NOTIFICATIONS
# ===================================================================
class TestNotifications:
    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session):
        # Teacher + Student + complete a session to generate notifications
        _register(client, "notif_t@example.com", "teacher", "Notif Teacher")
        _register(client, "notif_s@example.com", "student", "Notif Student")
        self.t_headers = _auth_header("notif_t@example.com", "teacher")
        self.s_headers = _auth_header("notif_s@example.com", "student")

        _seed_subject(db_session, "hist101", "History")
        client.post(
            "/api/v1/teachers/subjects",
            headers=self.t_headers,
            json={"sub_id": "hist101"},
        )
        r = client.get("/api/v1/teachers/subjects", headers=self.t_headers)
        entry_id = r.json()[0]["id"]

        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "mon", "start_time": "08:00", "end_time": "08:30"},
        )
        slot_id = r.json()["id"]

        # Request session → notification sent to teacher
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "notif_t@example.com",
                "subject_master_id": entry_id,
                "slot_id": slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
            },
        )
        self.session_id = r.json()["id"]

    def test_list_notifications(self, client: TestClient):
        r = client.get("/api/v1/notifications", headers=self.t_headers)
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    def test_unread_count(self, client: TestClient):
        r = client.get("/api/v1/notifications/unread-count", headers=self.t_headers)
        assert r.status_code == 200
        assert r.json()["count"] >= 1

    def test_mark_as_read(self, client: TestClient):
        r = client.get("/api/v1/notifications", headers=self.t_headers)
        notif_id = r.json()["items"][0]["id"]

        r = client.put(
            f"/api/v1/notifications/{notif_id}/read", headers=self.t_headers
        )
        assert r.status_code == 200
        assert r.json()["is_read"] is True

        # Unread count should decrease
        r = client.get("/api/v1/notifications/unread-count", headers=self.t_headers)
        assert r.json()["count"] == 0

    def test_mark_other_users_notification_404(self, client: TestClient):
        r = client.get("/api/v1/notifications", headers=self.t_headers)
        notif_id = r.json()["items"][0]["id"]
        # Student tries to mark teacher's notification
        r = client.put(
            f"/api/v1/notifications/{notif_id}/read", headers=self.s_headers
        )
        assert r.status_code == 404


# ===================================================================
# 8. RATINGS
# ===================================================================
class TestRatings:
    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session):
        _register(client, "rate_t@example.com", "teacher", "Rate Teacher")
        _register(client, "rate_s@example.com", "student", "Rate Student")
        self.t_headers = _auth_header("rate_t@example.com", "teacher")
        self.s_headers = _auth_header("rate_s@example.com", "student")

        client.put(
            "/api/v1/teachers/profile",
            headers=self.t_headers,
            json={"per_30_mins_charges": 100},
        )

        _seed_subject(db_session, "chem101", "Chemistry")
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.t_headers,
            json={"sub_id": "chem101"},
        )
        entry_id = r.json()["id"]

        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "sat", "start_time": "11:00", "end_time": "11:30"},
        )
        slot_id = r.json()["id"]

        # Request + accept + complete
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "rate_t@example.com",
                "subject_master_id": entry_id,
                "slot_id": slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
            },
        )
        self.session_id = r.json()["id"]
        client.put(
            f"/api/v1/sessions/{self.session_id}/accept", headers=self.t_headers
        )
        client.put(
            f"/api/v1/sessions/{self.session_id}/complete", headers=self.t_headers
        )

    def test_pending_ratings(self, client: TestClient):
        r = client.get("/api/v1/ratings/pending", headers=self.s_headers)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["session_id"] == self.session_id

    def test_submit_rating(self, client: TestClient):
        r = client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={
                "session_id": self.session_id,
                "stars": 5,
                "review_text": "Great session!",
            },
        )
        assert r.status_code == 201
        assert r.json()["stars"] == 5

    def test_no_duplicate_rating(self, client: TestClient):
        client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": self.session_id, "stars": 4},
        )
        r = client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": self.session_id, "stars": 3},
        )
        assert r.status_code == 400

    def test_pending_cleared_after_rating(self, client: TestClient):
        client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": self.session_id, "stars": 5},
        )
        r = client.get("/api/v1/ratings/pending", headers=self.s_headers)
        assert len(r.json()) == 0

    def test_both_parties_can_rate(self, client: TestClient):
        # Student rates
        r = client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": self.session_id, "stars": 5},
        )
        assert r.status_code == 201
        # Teacher rates
        r = client.post(
            "/api/v1/ratings",
            headers=self.t_headers,
            json={"session_id": self.session_id, "stars": 4},
        )
        assert r.status_code == 201

    def test_cannot_rate_non_completed(self, client: TestClient, db_session: Session):
        # Create a new session that's just requested (not completed)
        _seed_subject(db_session, "bio101", "Biology")
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.t_headers,
            json={"sub_id": "bio101"},
        )
        entry_id = r.json()["id"]
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "sun", "start_time": "12:00", "end_time": "12:30"},
        )
        slot_id = r.json()["id"]
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "rate_t@example.com",
                "subject_master_id": entry_id,
                "slot_id": slot_id,
                "session_date": str(date.today() + timedelta(days=5)),
            },
        )
        new_session_id = r.json()["id"]
        r = client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": new_session_id, "stars": 3},
        )
        assert r.status_code == 400

    def test_outsider_cannot_rate(self, client: TestClient):
        _register(client, "outsider@example.com", "student")
        outsider_h = _auth_header("outsider@example.com", "student")
        r = client.post(
            "/api/v1/ratings",
            headers=outsider_h,
            json={"session_id": self.session_id, "stars": 1},
        )
        assert r.status_code == 404

    def test_star_validation(self, client: TestClient):
        r = client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": self.session_id, "stars": 0},
        )
        assert r.status_code == 422
        r = client.post(
            "/api/v1/ratings",
            headers=self.s_headers,
            json={"session_id": self.session_id, "stars": 6},
        )
        assert r.status_code == 422


# ===================================================================
# 9. PAYMENTS & EARNINGS
# ===================================================================
class TestPayments:
    """Payment orders, webhook capture, monthly earnings, withdrawal processing."""

    @pytest.fixture(autouse=True)
    def _setup(self, client: TestClient, db_session: Session, monkeypatch):
        monkeypatch.setattr(settings, "PAYMENT_GATEWAY", "mock")
        monkeypatch.setattr(settings, "PAYMENT_WEBHOOK_SECRET", "test_webhook_secret")
        # Teacher
        _register(client, "pay_t@example.com", "teacher", "Pay Teacher")
        self.t_headers = _auth_header("pay_t@example.com", "teacher")
        client.put(
            "/api/v1/teachers/profile",
            headers=self.t_headers,
            json={"per_30_mins_charges": 300},
        )
        # Subject + slot
        _seed_subject(db_session, "geo101", "Geography")
        r = client.post(
            "/api/v1/teachers/subjects",
            headers=self.t_headers,
            json={"sub_id": "geo101"},
        )
        self.entry_id = r.json()["id"]
        r = client.post(
            "/api/v1/teachers/availability",
            headers=self.t_headers,
            json={"day_of_week": "mon", "start_time": "10:00", "end_time": "10:30"},
        )
        self.slot_id = r.json()["id"]
        # Student
        _register(client, "pay_s@example.com", "student", "Pay Student")
        self.s_headers = _auth_header("pay_s@example.com", "student")

    def _create_completed_session(self, client: TestClient) -> str:
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "pay_t@example.com",
                "subject_master_id": self.entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
            },
        )
        session_id = r.json()["id"]
        client.put(f"/api/v1/sessions/{session_id}/accept", headers=self.t_headers)
        client.put(f"/api/v1/sessions/{session_id}/complete", headers=self.t_headers)
        return session_id

    def _create_order(self, client: TestClient, session_id: str) -> dict:
        r = client.post(
            "/api/v1/payments/orders",
            headers=self.s_headers,
            json={"session_id": session_id},
        )
        assert r.status_code == 200, r.text
        return r.json()

    def _capture_order(self, client: TestClient, order: dict) -> dict:
        payload = {
            "event_id": f"evt_{order['transaction_id']}",
            "event_type": "payment.captured",
            "data": {
                "order_id": order["gateway_order_id"],
                "payment_id": f"pay_{order['transaction_id']}",
            },
        }
        raw = _raw_json(payload)
        r = client.post(
            "/api/v1/payments/webhook/mock",
            headers={
                "X-Payment-Signature": _webhook_signature(raw),
                "Content-Type": "application/json",
            },
            content=raw,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_razorpay_test_mode_order_creation(self, client: TestClient):
        session_id = self._create_completed_session(client)

        class _FakeResponse:
            status_code = 200

            @staticmethod
            def json():
                return {
                    "id": "order_test_123",
                    "amount": 32000,
                    "currency": "INR",
                }

        with patch("app.services.payment_gateway_service.httpx.post", return_value=_FakeResponse()):
            with patch.object(settings, "PAYMENT_GATEWAY", "razorpay"):
                with patch.object(settings, "PAYMENT_GATEWAY_KEY_ID", "rzp_test_key"):
                    with patch.object(settings, "PAYMENT_GATEWAY_KEY_SECRET", "rzp_test_secret"):
                        r = client.post(
                            "/api/v1/payments/orders",
                            headers=self.s_headers,
                            json={"session_id": session_id},
                        )

        assert r.status_code == 200, r.text
        body = r.json()
        assert body["gateway"] == "razorpay"
        assert body["gateway_order_id"] == "order_test_123"
        assert body["total_payable"] == 320

    # ---- Orders + capture ----
    def test_create_payment_order(self, client: TestClient):
        session_id = self._create_completed_session(client)
        body = self._create_order(client, session_id)
        assert body["status"] == "created"
        assert body["session_type"] == "individual"
        assert body["gross_amount"] == 300
        assert body["platform_charge"] == 20
        assert body["commission_charge"] == 30
        assert body["net_payout"] == 270
        assert body["total_payable"] == 320
        assert body["currency"] == "INR"
        assert body["payee_id"] == "pay_t@example.com"
        assert body["payer_id"] == "pay_s@example.com"

    def test_create_payment_order_not_accepted_or_completed(self, client: TestClient):
        """Cannot create order for a requested session."""
        r = client.post(
            "/api/v1/sessions/request",
            headers=self.s_headers,
            json={
                "teacher_id": "pay_t@example.com",
                "subject_master_id": self.entry_id,
                "slot_id": self.slot_id,
                "session_date": str(date.today() + timedelta(days=2)),
            },
        )
        session_id = r.json()["id"]
        r = client.post(
            "/api/v1/payments/orders",
            headers=self.s_headers,
            json={"session_id": session_id},
        )
        assert r.status_code == 400

    def test_create_payment_order_invalid_session(self, client: TestClient):
        r = client.post(
            "/api/v1/payments/orders",
            headers=self.s_headers,
            json={"session_id": "nonexistent"},
        )
        assert r.status_code == 404

    def test_webhook_capture_updates_wallet_and_transaction(self, client: TestClient):
        session_id = self._create_completed_session(client)
        order = self._create_order(client, session_id)
        ack = self._capture_order(client, order)
        assert ack["event_status"] == "processed"
        assert ack["transaction_status"] == "captured"

        tx = client.get(
            f"/api/v1/payments/transactions/{order['transaction_id']}",
            headers=self.s_headers,
        )
        assert tx.status_code == 200
        assert tx.json()["status"] == "captured"

        wallet = client.get("/api/v1/teachers/earnings", headers=self.t_headers)
        assert wallet.status_code == 200
        assert wallet.json()["current_balance"] == 270

    def test_webhook_replay_is_idempotent(self, client: TestClient):
        session_id = self._create_completed_session(client)
        order = self._create_order(client, session_id)
        self._capture_order(client, order)

        replay_payload = {
            "event_id": f"evt_{order['transaction_id']}",
            "event_type": "payment.captured",
            "data": {
                "order_id": order["gateway_order_id"],
                "payment_id": f"pay_{order['transaction_id']}",
            },
        }
        replay = client.post(
            "/api/v1/payments/webhook/mock",
            headers={
                "X-Payment-Signature": _webhook_signature(_raw_json(replay_payload)),
                "Content-Type": "application/json",
            },
            content=_raw_json(replay_payload),
        )
        assert replay.status_code == 200
        assert replay.json()["event_status"] == "duplicate"

        wallet = client.get("/api/v1/teachers/earnings", headers=self.t_headers)
        assert wallet.json()["current_balance"] == 270

    def test_webhook_invalid_signature(self, client: TestClient):
        payload = {
            "event_id": "evt_invalid_sig",
            "event_type": "payment.captured",
            "data": {"order_id": "none", "payment_id": "none"},
        }
        r = client.post(
            "/api/v1/payments/webhook/mock",
            headers={"X-Payment-Signature": "bad-signature"},
            content=_raw_json(payload),
        )
        assert r.status_code == 400

    # ---- Monthly earnings ----
    def test_monthly_earnings_with_sessions(self, client: TestClient):
        session_id = self._create_completed_session(client)
        order = self._create_order(client, session_id)
        self._capture_order(client, order)
        today = date.today() + timedelta(days=1)
        r = client.get(
            "/api/v1/teachers/earnings/monthly",
            headers=self.t_headers,
            params={"year": today.year, "month": today.month},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["sessions_completed"] == 1
        assert body["amount_earned"] == 270
        assert body["year"] == today.year
        assert body["month"] == today.month

    def test_monthly_earnings_empty_month(self, client: TestClient):
        r = client.get(
            "/api/v1/teachers/earnings/monthly",
            headers=self.t_headers,
            params={"year": 2020, "month": 1},
        )
        assert r.status_code == 200
        assert r.json()["sessions_completed"] == 0
        assert r.json()["amount_earned"] == 0

    def test_monthly_earnings_via_payments_router(self, client: TestClient):
        """The /payments/earnings/monthly endpoint works too."""
        session_id = self._create_completed_session(client)
        order = self._create_order(client, session_id)
        self._capture_order(client, order)
        today = date.today() + timedelta(days=1)
        r = client.get(
            "/api/v1/payments/earnings/monthly",
            headers=self.t_headers,
            params={"year": today.year, "month": today.month},
        )
        assert r.status_code == 200
        assert r.json()["sessions_completed"] == 1

    # ---- Withdrawal processing ----
    def test_withdrawal_success(self, client: TestClient):
        session_id = self._create_completed_session(client)
        order = self._create_order(client, session_id)
        self._capture_order(client, order)
        # Request withdrawal
        r = client.post(
            "/api/v1/teachers/withdrawals",
            headers=self.t_headers,
            json={"amount": 100},
        )
        assert r.status_code == 201
        withdrawal_id = r.json()["id"]

        # Process it as success
        r = client.post(
            "/api/v1/payments/withdrawals/process",
            headers=self.t_headers,
            json={"withdrawal_id": withdrawal_id, "success": True},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "success"

    def test_withdrawal_failed_refunds_balance(self, client: TestClient):
        session_id = self._create_completed_session(client)
        order = self._create_order(client, session_id)
        self._capture_order(client, order)
        # Balance is now 270 (300 gross - 10% commission)
        r = client.post(
            "/api/v1/teachers/withdrawals",
            headers=self.t_headers,
            json={"amount": 200},
        )
        withdrawal_id = r.json()["id"]
        # Balance is now 70

        # Mark as failed — should refund
        r = client.post(
            "/api/v1/payments/withdrawals/process",
            headers=self.t_headers,
            json={"withdrawal_id": withdrawal_id, "success": False},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "failed"

        # Check balance was restored
        r = client.get("/api/v1/teachers/earnings", headers=self.t_headers)
        assert r.json()["current_balance"] == 270
        assert r.json()["total_withdraw"] == 0

    def test_withdrawal_insufficient_balance(self, client: TestClient):
        r = client.post(
            "/api/v1/teachers/withdrawals",
            headers=self.t_headers,
            json={"amount": 1000},
        )
        assert r.status_code == 400

    def test_process_nonexistent_withdrawal(self, client: TestClient):
        r = client.post(
            "/api/v1/payments/withdrawals/process",
            headers=self.t_headers,
            json={"withdrawal_id": "nonexistent", "success": True},
        )
        assert r.status_code == 404
