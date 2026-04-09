"""Meeting smoke tests.

Validates end-to-end meeting lifecycle at API level:
student requests session -> teacher accepts -> both roles can join same room.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.subject import Subject
from app.utils.security import create_access_token


def _auth_header(user_name: str, role: str) -> dict:
    token = create_access_token({"sub": user_name, "role": role})
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str, role: str, full_name: str = "Smoke User"):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "user_name": email,
            "password": "Str0ngP@ss!",
            "role": role,
            "full_name": full_name,
        },
    )
    assert response.status_code == 201, response.text


def _seed_subject(db: Session, sub_id: str, name: str):
    subject = Subject(sub_id=sub_id, name=name)
    db.add(subject)
    db.commit()


class TestMeetingSmoke:
    def test_meeting_end_to_end_smoke(self, client: TestClient, db_session: Session):
        teacher_email = "meeting_teacher@example.com"
        student_email = "meeting_student@example.com"

        _register(client, teacher_email, "teacher", "Meeting Teacher")
        _register(client, student_email, "student", "Meeting Student")

        teacher_headers = _auth_header(teacher_email, "teacher")
        student_headers = _auth_header(student_email, "student")

        # Setup teacher with charges, subject and availability.
        update_profile = client.put(
            "/api/v1/teachers/profile",
            headers=teacher_headers,
            json={"per_30_mins_charges": 300},
        )
        assert update_profile.status_code == 200, update_profile.text

        _seed_subject(db_session, "meet101", "Meeting Subject")

        add_subject = client.post(
            "/api/v1/teachers/subjects",
            headers=teacher_headers,
            json={"sub_id": "meet101"},
        )
        assert add_subject.status_code == 201, add_subject.text
        subject_entry_id = add_subject.json()["id"]

        add_slot = client.post(
            "/api/v1/teachers/availability",
            headers=teacher_headers,
            json={"day_of_week": "mon", "start_time": "10:00", "end_time": "10:30"},
        )
        assert add_slot.status_code == 201, add_slot.text
        slot_id = add_slot.json()["id"]

        # Student requests a session.
        request_session = client.post(
            "/api/v1/sessions/request",
            headers=student_headers,
            json={
                "teacher_id": teacher_email,
                "subject_master_id": subject_entry_id,
                "slot_id": slot_id,
                "session_date": str(date.today() + timedelta(days=1)),
                "topic_description": "Smoke check meeting",
            },
        )
        assert request_session.status_code == 201, request_session.text
        session_id = request_session.json()["id"]

        # Teacher accepts the request.
        accept_session = client.put(
            f"/api/v1/sessions/{session_id}/accept",
            headers=teacher_headers,
        )
        assert accept_session.status_code == 200, accept_session.text
        assert accept_session.json()["status"] == "Accepted"

        # Both roles should receive valid join payloads for the same meeting room.
        student_join = client.get(
            f"/api/v1/sessions/{session_id}/join",
            headers=student_headers,
        )
        assert student_join.status_code == 200, student_join.text

        teacher_join = client.get(
            f"/api/v1/sessions/{session_id}/join",
            headers=teacher_headers,
        )
        assert teacher_join.status_code == 200, teacher_join.text

        student_body = student_join.json()
        teacher_body = teacher_join.json()

        for body in (student_body, teacher_body):
            assert body.get("room_name")
            assert body.get("meeting_link")
            assert body.get("jwt_token")

        assert student_body["room_name"] == teacher_body["room_name"]
        assert student_body["meeting_link"] == teacher_body["meeting_link"]
