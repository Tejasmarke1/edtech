"""Integration tests for group (many-to-one) session endpoints."""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.subject import Subject
from app.utils.security import create_access_token


def _auth_header(user_name: str, role: str) -> dict:
    token = create_access_token({"sub": user_name, "role": role})
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str, role: str, full_name: str = "User"):
    return client.post(
        "/api/v1/auth/register",
        json={
            "user_name": email,
            "password": "Str0ngP@ss!",
            "role": role,
            "full_name": full_name,
        },
    )


def _seed_subject(db: Session, sub_id: str = "math101", name: str = "Mathematics"):
    subj = Subject(sub_id=sub_id, name=name)
    db.add(subj)
    db.commit()
    return subj


def test_group_session_end_to_end(client: TestClient, db_session: Session):
    # Arrange users
    _register(client, "group_teacher@example.com", "teacher", "Group Teacher")
    _register(client, "group_student@example.com", "student", "Group Student")

    teacher_headers = _auth_header("group_teacher@example.com", "teacher")
    student_headers = _auth_header("group_student@example.com", "student")

    # Arrange teacher profile + subject + availability
    _seed_subject(db_session, "math101", "Mathematics")

    r = client.put(
        "/api/v1/teachers/profile",
        headers=teacher_headers,
        json={"group_per_student_charges": 200},
    )
    assert r.status_code == 200, r.text

    r = client.post(
        "/api/v1/teachers/subjects",
        headers=teacher_headers,
        json={"sub_id": "math101"},
    )
    assert r.status_code == 201, r.text
    subject_master_id = r.json()["id"]

    r = client.post(
        "/api/v1/teachers/availability",
        headers=teacher_headers,
        json={"day_of_week": "mon", "start_time": "10:00", "end_time": "10:30"},
    )
    assert r.status_code == 201, r.text
    slot_id = r.json()["id"]

    # Teacher creates open group session
    r = client.post(
        "/api/v1/sessions/group",
        headers=teacher_headers,
        json={
            "subject_master_id": subject_master_id,
            "slot_id": slot_id,
            "session_date": str(date.today() + timedelta(days=1)),
            "max_students": 5,
            "topic_description": "Algebra basics",
        },
    )
    assert r.status_code == 201, r.text
    session_id = r.json()["id"]
    assert r.json()["session_type"] == "group"
    assert r.json()["status"] == "Open"

    # Student can discover open group sessions
    r = client.get("/api/v1/sessions/group/available", headers=student_headers)
    assert r.status_code == 200, r.text
    assert r.json()["total"] >= 1

    # Student enrolls
    r = client.post(f"/api/v1/sessions/{session_id}/enroll", headers=student_headers)
    assert r.status_code == 201, r.text
    assert r.json()["session_id"] == session_id

    # Teacher can view enrollments
    r = client.get(
        f"/api/v1/sessions/{session_id}/enrollments",
        headers=teacher_headers,
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1
    assert r.json()[0]["student_id"] == "group_student@example.com"

    # Teacher starts group session (Open -> Accepted)
    r = client.put(f"/api/v1/sessions/{session_id}/start", headers=teacher_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Accepted"

    # Enrolled student can join
    r = client.get(f"/api/v1/sessions/{session_id}/join", headers=student_headers)
    assert r.status_code == 200, r.text
    assert "meeting_link" in r.json()
    assert "jwt_token" in r.json()

    # Teacher completes session; credit now happens on payment capture webhook.
    r = client.put(f"/api/v1/sessions/{session_id}/complete", headers=teacher_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Completed"

    r = client.get("/api/v1/teachers/earnings", headers=teacher_headers)
    assert r.status_code == 200, r.text
    assert r.json()["current_balance"] == 0


def test_group_session_rejects_duplicate_enrollment(client: TestClient, db_session: Session):
    _register(client, "dup_teacher@example.com", "teacher", "Dup Teacher")
    _register(client, "dup_student@example.com", "student", "Dup Student")

    teacher_headers = _auth_header("dup_teacher@example.com", "teacher")
    student_headers = _auth_header("dup_student@example.com", "student")

    _seed_subject(db_session, "dup101", "Duplicate Test")

    r = client.post(
        "/api/v1/teachers/subjects",
        headers=teacher_headers,
        json={"sub_id": "dup101"},
    )
    assert r.status_code == 201, r.text
    subject_master_id = r.json()["id"]

    r = client.post(
        "/api/v1/teachers/availability",
        headers=teacher_headers,
        json={"day_of_week": "tue", "start_time": "11:00", "end_time": "11:30"},
    )
    assert r.status_code == 201, r.text
    slot_id = r.json()["id"]

    r = client.post(
        "/api/v1/sessions/group",
        headers=teacher_headers,
        json={
            "subject_master_id": subject_master_id,
            "slot_id": slot_id,
            "session_date": str(date.today() + timedelta(days=1)),
            "max_students": 3,
            "topic_description": "Duplicate enrollment",
        },
    )
    assert r.status_code == 201, r.text
    session_id = r.json()["id"]

    # First enrollment succeeds.
    r = client.post(f"/api/v1/sessions/{session_id}/enroll", headers=student_headers)
    assert r.status_code == 201, r.text

    # Second enrollment attempt by same student should fail.
    r = client.post(f"/api/v1/sessions/{session_id}/enroll", headers=student_headers)
    assert r.status_code == 400, r.text
    assert "already enrolled" in r.json()["detail"].lower()


def test_group_session_rejects_enrollment_when_full(client: TestClient, db_session: Session):
    _register(client, "cap_teacher@example.com", "teacher", "Capacity Teacher")
    _register(client, "cap_student1@example.com", "student", "Cap Student 1")
    _register(client, "cap_student2@example.com", "student", "Cap Student 2")
    _register(client, "cap_student3@example.com", "student", "Cap Student 3")

    teacher_headers = _auth_header("cap_teacher@example.com", "teacher")
    student1_headers = _auth_header("cap_student1@example.com", "student")
    student2_headers = _auth_header("cap_student2@example.com", "student")
    student3_headers = _auth_header("cap_student3@example.com", "student")

    _seed_subject(db_session, "cap101", "Capacity Test")

    r = client.post(
        "/api/v1/teachers/subjects",
        headers=teacher_headers,
        json={"sub_id": "cap101"},
    )
    assert r.status_code == 201, r.text
    subject_master_id = r.json()["id"]

    r = client.post(
        "/api/v1/teachers/availability",
        headers=teacher_headers,
        json={"day_of_week": "wed", "start_time": "12:00", "end_time": "12:30"},
    )
    assert r.status_code == 201, r.text
    slot_id = r.json()["id"]

    # Create a session with capacity 2 (schema minimum is 2).
    r = client.post(
        "/api/v1/sessions/group",
        headers=teacher_headers,
        json={
            "subject_master_id": subject_master_id,
            "slot_id": slot_id,
            "session_date": str(date.today() + timedelta(days=1)),
            "max_students": 2,
            "topic_description": "Capacity limit",
        },
    )
    assert r.status_code == 201, r.text
    session_id = r.json()["id"]

    # First two students fill the session.
    r = client.post(f"/api/v1/sessions/{session_id}/enroll", headers=student1_headers)
    assert r.status_code == 201, r.text
    r = client.post(f"/api/v1/sessions/{session_id}/enroll", headers=student2_headers)
    assert r.status_code == 201, r.text

    # Third student should be rejected as session is full.
    r = client.post(f"/api/v1/sessions/{session_id}/enroll", headers=student3_headers)
    assert r.status_code == 400, r.text
    assert "full" in r.json()["detail"].lower()
