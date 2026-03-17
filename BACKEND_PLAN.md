# YES Doubt-Resolution Platform — Backend Development Plan

> **Tech Stack:** Python · FastAPI · PostgreSQL · Redis · Docker · Poetry  
> **Architecture:** Modular / Layered (routers → services → repositories → models)

---

## Phase 1 — Project Scaffolding & Infrastructure

### 1.1 Poetry & Dependency Setup (`pyproject.toml`)

Install core dependencies:

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn[standard]` | ASGI server |
| `sqlalchemy[asyncio]` | ORM (async) |
| `asyncpg` | PostgreSQL async driver |
| `alembic` | Database migrations |
| `pydantic-settings` | Config / env management |
| `python-jose[cryptography]` | JWT token handling |
| `passlib[bcrypt]` | Password hashing |
| `redis[hiredis]` | Caching & pub/sub (notifications) |
| `python-multipart` | File upload support |
| `httpx` | Async HTTP client |
| `celery` | Background task queue |

Dev dependencies: `pytest`, `pytest-asyncio`, `httpx` (test client), `ruff`, `black`, `mypy`

### 1.2 Docker Compose Setup

Services to define in `docker-compose.yml`:

| Service | Image | Port |
|---|---|---|
| **app** | Build from `Dockerfile` | `8000` |
| **postgres** | `postgres:16-alpine` | `5432` |
| **redis** | `redis:7-alpine` | `6379` |
| **celery-worker** | Same image as app | — |

- Use `.env` file for all secrets/config  
- Named volumes for persistent data (`pgdata`, `redisdata`)

### 1.3 Modular Folder Structure

```
edtech-doubt-resolution/
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── poetry.lock
├── alembic/                    # DB migration scripts
│   ├── alembic.ini
│   ├── env.py
│   └── versions/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Pydantic settings (env vars)
│   ├── database.py             # SQLAlchemy engine & session
│   ├── dependencies.py         # Shared FastAPI dependencies
│   │
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py             # user + user_profile
│   │   ├── teacher.py          # teacher_profile, teacher_subject_master_list, teacher_video_demo
│   │   ├── subject.py          # subject (master list)
│   │   ├── availability.py     # availability_slots
│   │   ├── session.py          # session_schedule
│   │   ├── rating.py           # rating
│   │   ├── wallet.py           # teacher_wallet, withdrawal
│   │   └── notification.py     # notification
│   │
│   ├── schemas/                # Pydantic request / response schemas
│   │   ├── __init__.py
│   │   ├── user.py             # user + user_profile schemas
│   │   ├── auth.py             # login / register / token schemas
│   │   ├── teacher.py          # teacher_profile, subject_master, video_demo schemas
│   │   ├── subject.py          # subject schemas
│   │   ├── availability.py     # availability_slots schemas
│   │   ├── session.py          # session_schedule schemas
│   │   ├── rating.py           # rating schemas
│   │   ├── wallet.py           # teacher_wallet, withdrawal schemas
│   │   └── notification.py     # notification schemas
│   │
│   ├── routers/                # API route handlers (controllers)
│   │   ├── __init__.py
│   │   ├── auth.py             # Login, Register, Token refresh
│   │   ├── teachers.py         # Teacher profile, subjects, videos
│   │   ├── students.py         # Student profile
│   │   ├── sessions.py         # Schedule, accept, reject, join
│   │   ├── search.py           # Search teachers by topic
│   │   ├── ratings.py          # Post-session ratings
│   │   ├── payments.py         # Earnings, withdrawals
│   │   └── notifications.py    # Notification endpoints
│   │
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── teacher_service.py
│   │   ├── student_service.py
│   │   ├── session_service.py
│   │   ├── search_service.py
│   │   ├── rating_service.py
│   │   ├── payment_service.py
│   │   └── notification_service.py
│   │
│   ├── repositories/           # Data access layer (DB queries)
│   │   ├── __init__.py
│   │   ├── user_repo.py
│   │   ├── teacher_repo.py
│   │   ├── subject_repo.py
│   │   ├── availability_repo.py
│   │   ├── session_repo.py
│   │   ├── rating_repo.py
│   │   └── wallet_repo.py
│   │
│   ├── utils/                  # Shared helpers
│   │   ├── __init__.py
│   │   ├── security.py         # JWT encode/decode, password hash
│   │   ├── pagination.py       # Pagination helpers
│   │   └── exceptions.py       # Custom HTTP exceptions
│   │
│   └── tasks/                  # Celery / background tasks
│       ├── __init__.py
│       └── notification_tasks.py
│
└── tests/
    ├── conftest.py
    ├── test_auth.py
    ├── test_teachers.py
    ├── test_students.py
    ├── test_sessions.py
    └── test_payments.py
```

---

## Phase 2 — Data Modelling & Database

### 2.1 Core Database Tables

#### `user` — Core authentication table

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `user_name` | VARCHAR | **PK** | Unique identifier for each user (email_id) |
| `password` | VARCHAR | — | Hashed password |
| `is_verified` | BOOLEAN | — | Whether the user has been verified |
| `role` | ENUM(`student`, `teacher`) | — | Role of the user |

#### `user_profile` — Extended user details

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `user_name` | VARCHAR | **FK → user.user_name** | Links to user |
| `full_name` | VARCHAR | — | Name of the user |
| `dob` | DATE | — | Date of birth |
| `gender` | ENUM(`male`, `female`, `other`) | — | Gender |

#### `teacher_profile` — Teacher-specific details

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `user_name` | VARCHAR | **FK → user.user_name** | Links to user |
| `bio` | VARCHAR | — | Bio for teacher |
| `per_30_mins_charges` | INT | — | Charges per 30-minute session |
| `upi_id` | VARCHAR | — | UPI ID for withdrawal |

#### `teacher_subject_master_list` — Subjects a teacher is SME in

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique ID for each record |
| `user_name` | VARCHAR | **FK → user.user_name** | Links to teacher |
| `sub_id` | VARCHAR | **FK → subject.sub_id** | Links to subject |
| `is_active` | BOOLEAN | — | Soft-delete flag (set `false` on delete) |

> **Validation Rule:** Max 5 active records per teacher.

#### `teacher_video_demo` — Teaching demo videos

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique video ID |
| `user_name` | VARCHAR | **FK → user.user_name** | Links to teacher |
| `sub_id` | VARCHAR | **FK → subject.sub_id** | Links to subject |
| `video_url` | VARCHAR | — | Link of the video |
| `duration_seconds` | INTEGER | — | Duration of the video in seconds |
| `created_at` | DATE | — | Upload date |

> **Validation Rule:** Per subject — 2 videos of max 10 min each, OR 1 video of 10 min.

#### `availability_slots` — Teacher availability windows

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique slot ID |
| `user_name` | VARCHAR | **FK → user.user_name** | Links to teacher |
| `day_of_week` | ENUM(`mon`,`tue`,`wed`,`thu`,`fri`,`sat`,`sun`) | — | Day of the week |
| `start_time` | STRING | — | Start time (e.g. `"12:00"`) |
| `end_time` | STRING | — | End time (e.g. `"12:30"`) |
| `is_active` | BOOLEAN | — | Whether the slot is currently active |

#### `session_schedule` — Scheduled doubt-resolution sessions

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique session ID |
| `teacher_id` | VARCHAR | **FK → user.user_name** | ID of the teacher |
| `student_id` | VARCHAR | **FK → user.user_name** | ID of the student |
| `subject_master_id` | VARCHAR | **FK → teacher_subject_master_list.id** | Subject being taught |
| `topic_description` | TEXT | — | Extra description added by student |
| `slot_id` | VARCHAR | **FK → availability_slots.id** | Booked time slot |
| `session_date` | DATE | — | Date of the session |
| `status` | ENUM | — | `Requested`, `Accepted`, `Rejected`, `Rescheduled`, `Completed`, `Cancelled` |
| `meeting_link` | VARCHAR | — | Google Meet / Jitsi link (requires Google Calendar API) |

#### `rating` — Post-session ratings

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique rating ID |
| `session_id` | VARCHAR | **FK → session_schedule.id** | Links to session |
| `rated_by` | VARCHAR | **FK → user.user_name** | Who gave the rating |
| `stars` | INT | — | Rating value (1–5) |
| `review_text` | STRING | — | Optional review text |
| `created_at` | DATE | — | Rating date |

#### `teacher_wallet` — Teacher earnings ledger

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique wallet ID |
| `teacher_id` | VARCHAR | **FK → user.user_name** | Links to teacher |
| `total_earned` | INT | — | Lifetime earnings |
| `total_withdraw` | INT | — | Lifetime withdrawn amount |
| `current_balance` | INT | — | Available balance to withdraw |
| `updated_at` | DATE | — | Last updated timestamp |

#### `withdrawal` — Withdrawal requests

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique withdrawal ID |
| `teacher_id` | VARCHAR | **FK → user.user_name** | Links to teacher |
| `amount` | INT | — | Amount to withdraw |
| `status` | ENUM(`requested`, `success`, `failed`) | — | Withdrawal status |
| `request_at` | DATE | — | Request timestamp |
| `processed_at` | DATE | — | Processing completion timestamp |

### 2.2 Entity Relationship Summary

```
user (PK: user_name)
 ├── 1:1  user_profile
 ├── 1:1  teacher_profile          (if role = teacher)
 ├── 1:N  teacher_subject_master_list  (max 5 active)
 │         └── N:1 subject
 ├── 1:N  teacher_video_demo
 ├── 1:N  availability_slots
 ├── 1:N  session_schedule          (as teacher_id or student_id)
 ├── 1:N  rating                    (as rated_by)
 ├── 1:1  teacher_wallet            (if role = teacher)
 └── 1:N  withdrawal                (if role = teacher)
```

### 2.3 Alembic Migrations

- Configure async Alembic with SQLAlchemy
- Create initial migration for all tables
- Seed subjects table with default subject list

---

## Phase 3 — Authentication & User Management

### 3.1 Auth APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register (teacher or student) |
| POST | `/api/v1/auth/login` | Login → returns JWT access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET  | `/api/v1/auth/me` | Get current user profile |

### 3.2 Implementation Details

- Password hashing with `bcrypt`
- JWT access tokens (short-lived, ~30 min) + refresh tokens (long-lived, ~7 days)
- Role-based middleware (`is_teacher`, `is_student`)
- Store refresh tokens in Redis for revocation

---

## Phase 4 — Teacher Module

### 4.1 Teacher APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/teachers/profile` | Get own teacher profile |
| PUT | `/api/v1/teachers/profile` | Update profile |
| POST | `/api/v1/teachers/subjects` | Choose up to 5 SME subjects |
| POST | `/api/v1/teachers/subjects/{id}/videos` | Upload teaching videos (min 2×5min or 1×10min) |
| GET | `/api/v1/teachers/availability` | Get availability schedule |
| PUT | `/api/v1/teachers/availability` | Set/update availability timeline |
| GET | `/api/v1/teachers/earnings` | Total earnings, withdrawals, monthly filter |
| POST | `/api/v1/teachers/withdrawals` | Request withdrawal |

### 4.2 Business Rules

- Max **5 active** subjects per teacher (soft-delete via `is_active` flag in `teacher_subject_master_list`)
- Video validation: **2 videos of max 10 min each** OR **1 video of 10 min** per subject (stored in `teacher_video_demo`)
- Availability defined in `availability_slots` (30-min windows with `day_of_week`, `start_time`, `end_time`)
- Teacher charges defined in `teacher_profile.per_30_mins_charges`
- Earnings tracked in `teacher_wallet` (total_earned, total_withdraw, current_balance)
- Withdrawals processed via UPI (`teacher_profile.upi_id`)

---

## Phase 5 — Student Module

### 5.1 Student APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/students/profile` | Get own student profile |
| PUT | `/api/v1/students/profile` | Update profile |
| GET | `/api/v1/search?topic=...` | Search teachers by topic |
| GET | `/api/v1/teachers/{id}/detail` | View teacher profile, subjects, videos, pricing, availability |

### 5.2 Search Logic

- Full-text search on `subjects.name`
- Return matched teachers with: name, rating, subjects, availability windows, pricing
- Option: PostgreSQL `tsvector` / `trigram` for fuzzy search

---

## Phase 6 — Session Scheduling (Core Flow)

### 6.1 Session APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/sessions/request` | Student requests a session (teacher_id, subject_id, preferred_time, question) |
| GET | `/api/v1/sessions/my` | List my sessions (upcoming + history) |
| PUT | `/api/v1/sessions/{id}/accept` | Teacher accepts |
| PUT | `/api/v1/sessions/{id}/reject` | Teacher rejects |
| PUT | `/api/v1/sessions/{id}/propose-time` | Teacher proposes substitute time |
| PUT | `/api/v1/sessions/{id}/accept-substitute` | Student accepts substitute time |
| PUT | `/api/v1/sessions/{id}/reject-substitute` | Student rejects substitute time |
| GET | `/api/v1/sessions/{id}/join` | Get meeting link |
| PUT | `/api/v1/sessions/{id}/complete` | Mark session as completed |

### 6.2 Session State Machine (`session_schedule.status`)

```
Requested
  ├── Accepted  → Completed
  ├── Rejected
  ├── Rescheduled → Accepted → Completed
  └── Cancelled
```

Enum values: `Requested`, `Accepted`, `Rejected`, `Rescheduled`, `Completed`, `Cancelled`

### 6.3 Key Logic

- On **accept**: block teacher calendar, create meeting link, send notification to student
- On **reject**: notify student with "teacher not available" message
- On **substitute**: notify student with new time + accept/reject options
- On **complete**: trigger rating pop-up flag, process payment

---

## Phase 7 — Notifications

### 7.1 Notification APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/notifications` | List notifications (paginated) |
| PUT | `/api/v1/notifications/{id}/read` | Mark as read |
| GET | `/api/v1/notifications/unread-count` | Get unread count |

### 7.2 Implementation

- Store notifications in DB
- Use Redis pub/sub or WebSockets (future) for real-time push
- Celery tasks for async notification delivery
- Notification types: `session_request`, `session_accepted`, `session_rejected`, `substitute_proposed`, `rating_reminder`, `payment_received`

---

## Phase 8 — Ratings

### 8.1 Rating APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/ratings` | Submit rating (after session ends) |
| GET | `/api/v1/ratings/pending` | Check if user has pending ratings |

### 8.2 Logic

- After session completes, flag both users for pending rating
- On next app visit, show pop-up (frontend consumes `/ratings/pending`)
- Teacher rates student; Student rates teacher + session
- Recalculate `rating_avg` on user profile

---

## Phase 9 — Payments

### 9.1 Payment APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/payments/process` | Process payment on session completion |
| GET | `/api/v1/teachers/earnings` | Earnings dashboard |
| GET | `/api/v1/teachers/earnings?month=2026-03` | Monthly filter |
| POST | `/api/v1/teachers/withdrawals` | Request amount withdrawal |
| GET | `/api/v1/teachers/withdrawals` | Withdrawal history |

### 9.2 Payment & Wallet Model

```
Student pays  →  teacher_profile.per_30_mins_charges (per 30 min)
Teacher gets  →  credited to teacher_wallet.total_earned & current_balance
Withdrawal    →  via teacher_profile.upi_id, tracked in withdrawal table
```

- `teacher_wallet`: single record per teacher tracking `total_earned`, `total_withdraw`, `current_balance`
- `withdrawal`: each request tracked with status (`requested` → `success` / `failed`)
- Mock payment gateway for now (as per requirements: "mockup of payment")
- Monthly earnings filter via `session_schedule.session_date`

---

## Phase 10 — Group Session Support (Many-to-One)

### 10.1 Overview

Extend the platform to support both session types without breaking existing one-to-one sessions:

| Aspect | Individual (1:1) | Group (many:1) |
|---|---|---|
| Initiator | Student | **Teacher** |
| `session_schedule.student_id` | Populated | `NULL` |
| Enrollment | Implicit | New `session_enrollment` table |
| Pricing | `per_30_mins_charges` | `group_per_student_charges × enrolled_count` |
| Status flow | `Requested → Accepted → Completed` | `Open → Accepted → Completed` |

### 10.2 New Database Table: `session_enrollment`

| Attribute | Datatype | Key | Description |
|---|---|---|---|
| `id` | VARCHAR | **PK** | Unique enrollment ID |
| `session_id` | VARCHAR | **FK → session_schedule.id** | The group session |
| `student_id` | VARCHAR | **FK → user.user_name** | Enrolled student |
| `status` | ENUM(`enrolled`, `cancelled`) | — | Enrollment status |

> **Constraint:** `UNIQUE(session_id, student_id)` — one slot per student per session.

### 10.3 Schema Changes to Existing Tables

**`session_schedule`** — two new columns; `student_id` becomes nullable:

| Change | Description |
|---|---|
| `session_type` | ENUM(`individual`, `group`) DEFAULT `individual` |
| `max_students` | INTEGER nullable — capacity for group sessions |
| `student_id` | Now **nullable** (NULL for group sessions) |

**`teacher_profile`** — one new column:

| Change | Description |
|---|---|
| `group_per_student_charges` | INTEGER nullable — per-student price for group sessions |

### 10.4 Group Session Lifecycle

```
Teacher creates group session
          ↓
       [Open]  ──── Students enroll ────► capacity reached or teacher starts
          ↓
      [Accepted]
          ↓
   Teacher completes  (wallet credited: group_per_student_charges × enrolled_count)
          ↓
     [Completed]
```

Students can cancel their enrollment any time before the session starts.

### 10.5 New APIs — Group Sessions

#### Teacher: publish group session
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/sessions/group` | Teacher | Create a group session (subject, slot, date, max_students, topic) |
| GET | `/api/v1/sessions/group/my` | Teacher | List own group sessions |

#### Student: discover & enroll
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/sessions/group/available` | Student | Browse open group sessions (filter by subject) |
| POST | `/api/v1/sessions/{id}/enroll` | Student | Enroll in a group session |
| DELETE | `/api/v1/sessions/{id}/enroll` | Student | Cancel enrollment |

#### Shared: enrollments view
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/sessions/{id}/enrollments` | Teacher/Enrolled Student | View enrolled students + count |

### 10.6 Join Logic (Unified)

`GET /api/v1/sessions/{id}/join` already exists. Extended to handle group sessions:
- **Individual**: participant must be the teacher or the specific student_id
- **Group**: participant must be the teacher OR any student with `status=enrolled`

### 10.7 Business Rules

| Rule | Where enforced |
|---|---|
| Only teachers can create group sessions | `require_teacher` dependency |
| Student cannot enroll twice | `UNIQUE(session_id, student_id)` + service check |
| Cannot enroll if at capacity | `enrollment_repo.get_active_enrollment_count` |
| Cannot enroll in past/non-open sessions | Service validate `status == Open` |
| Wallet credit = `group_per_student_charges × active_enrollments` | `complete_session` in service |
| Existing individual sessions are unaffected | `session_type` defaults to `individual` |

### 10.8 Migration

New Alembic migration (`_add_group_session_support`):
1. Add `session_type`, `max_students` to `session_schedule`; alter `student_id` to nullable
2. Add `group_per_student_charges` to `teacher_profile`
3. Create `session_enrollment` table with unique constraint

---

## Phase 11 — Video Calling Integration (Research)

### 10.1 Jitsi Integration (Proposed)

- Self-hosted Jitsi Meet via Docker or use Jitsi public API
- Generate unique room URLs per session
- Embed within frontend via iframe
- Future: digital whiteboard, YouTube embed, PDF sharing, AI smart notes

### 10.2 API for Meeting

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/sessions/{id}/create-room` | Generate Jitsi room link |
| GET | `/api/v1/sessions/{id}/join` | Return room URL + JWT token for Jitsi |

---

## Phase 11 — Testing & Quality

- **Unit tests**: Services layer with mocked repositories
- **Integration tests**: API endpoints with test DB
- **Fixtures**: `conftest.py` with async test client, test DB, seed data
- **Linting**: `ruff` + `black` for formatting
- **Type checking**: `mypy`

---

## Phase 12 — Deployment Prep

- Multi-stage `Dockerfile` (builder + runtime)
- `docker-compose.yml` for local dev (app + postgres + redis + celery)
- `docker-compose.prod.yml` for production overrides
- Health check endpoints (`/health`, `/ready`)
- Structured JSON logging
- CORS middleware configuration
- API versioning (`/api/v1/...`)

---

## Execution Order (Step by Step)

| Step | Task | Status |
|---|---|---|
| 1 | ~~Poetry setup (`pyproject.toml`)~~ | ✅ Done |
| 2 | ~~Docker Compose + Dockerfile~~ | ✅ Done |
| 3 | ~~Folder structure + `app/main.py` + config~~ | ✅ Done |
| 4 | ~~Database setup (SQLAlchemy + Alembic)~~ | ✅ Done |
| 5 | ~~Data models (all tables)~~ | ✅ Done |
| 6 | ~~Auth module (register, login, JWT)~~ | ✅ Done |
| 7 | ~~Teacher module (profile, subjects, videos, availability)~~ | ✅ Done |
| 8 | ~~Student module (profile, search)~~ | ✅ Done |
| 9 | ~~Session scheduling (full flow)~~ | ✅ Done |
| 10 | ~~Notifications~~ | ✅ Done |
| 11 | ~~Ratings~~ | ✅ Done |
| 12 | ~~Payments & earnings~~ | ✅ Done |
| 13 | ~~Jitsi integration~~ | ✅ Done |
| 14 | ~~Group session support (Phase 10)~~ — models, enrollment repo, service, routes, migration | ✅ Done |
| 15 | Tests | ⬜ |
| 16 | Deployment config | ⬜ |

---

*This document will be updated as we progress through each phase.*
