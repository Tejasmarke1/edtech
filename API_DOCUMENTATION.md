# Edtech Backend API Documentation

## 1. Overview

This document describes the HTTP API exposed by the FastAPI backend in this repository.

- App entrypoint: `app/main.py`
- API base prefix: `/api/v1`
- Health endpoint: `/health`
- Auth style: Bearer JWT (`Authorization: Bearer <access_token>`)
- OAuth2 token URL: `/api/v1/auth/login`

## 2. Authentication and Authorization

### 2.1 Public Endpoints

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/payments/webhook/{provider}` (signature header required)

### 2.2 Authenticated Endpoints

All other `/api/v1/**` endpoints require a valid access token.

### 2.3 Role Guards

- Teacher-only endpoints use `require_teacher`.
- Student-only endpoints use `require_student`.
- Some endpoints allow any authenticated user (`get_current_user`).

## 3. Common Query Parameters

Paginated endpoints use:

- `skip` (int, default `0`, min `0`): records to skip
- `limit` (int, default `20`, min `1`, max `100`): records to return

Paginated response shape:

```json
{
  "items": [],
  "total": 0,
  "skip": 0,
  "limit": 20
}
```

## 4. Enums

### 4.1 UserRole

- `student`
- `teacher`

### 4.2 Gender

- `male`
- `female`
- `other`

### 4.3 DayOfWeek

- `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`

### 4.4 SessionStatus

- `Requested`
- `Accepted`
- `Rejected`
- `Rescheduled`
- `Completed`
- `Cancelled`
- `Open`

### 4.5 SessionType

- `individual`
- `group`

### 4.6 WithdrawalStatus

- `requested`
- `success`
- `failed`

### 4.7 NotificationType

- `session_request`
- `session_accepted`
- `session_rejected`
- `session_completed`
- `substitute_proposed`
- `rating_reminder`
- `payment_received`
- `withdrawal_processed`
- `general`

## 5. Error Codes

Custom exceptions used in services/routers:

- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`

## 6. Endpoint Reference

## 6.1 Health

### `GET /health`

- Auth: Public
- Description: Service health check.
- Response:

```json
{ "status": "ok" }
```

## 6.2 Auth

### `POST /api/v1/auth/register`

- Auth: Public
- Description: Register student or teacher account.
- Request JSON (`RegisterRequest`):
  - `user_name` (email, required)
  - `password` (string, required, min 8, max 128)
  - `role` (`student|teacher`, required)
  - `full_name` (string, optional, max 255)
- Response 201 (`RegisterResponse`):
  - `user_name`
  - `role`
  - `message` (default: `Registration successful`)

### `POST /api/v1/auth/login`

- Auth: Public
- Description: Login and receive token pair.
- Content-Type: `application/x-www-form-urlencoded`
- Form fields:
  - `username` (required)
  - `password` (required)
- Response (`TokenResponse`):
  - `access_token`
  - `refresh_token`
  - `token_type` (`bearer`)

### `POST /api/v1/auth/refresh`

- Auth: Public
- Description: Exchange refresh token for new token pair.
- Request JSON (`R  efreshRequest`):
  - `refresh_token` (required)
- Response (`TokenResponse`)

### `GET /api/v1/auth/me`

- Auth: Any authenticated user
- Description: Get current user profile.
- Response (`UserRead`):
  - `user_name`
  - `is_verified`
  - `role`
  - `created_at`
  - `profile`:
    - `user_name`
    - `full_name`
    - `dob`
    - `gender`

## 6.3 Teachers

### `GET /api/v1/teachers/profile`

- Auth: Teacher only
- Description: Get teacher profile.
- Response (`TeacherProfileRead`)

### `PUT /api/v1/teachers/profile`

- Auth: Teacher only
- Description: Update teacher profile.
- Request JSON (`TeacherProfileUpdate`):
  - `bio` (string, optional, max 1000)
  - `per_30_mins_charges` (int, optional, >= 0)
  - `group_per_student_charges` (int, optional, >= 0)
  - `upi_id` (string, optional, max 255)
- Response (`TeacherProfileRead`)

### `GET /api/v1/teachers/subjects`

- Auth: Teacher only
- Description: List teacher subject mappings.
- Response: `TeacherSubjectRead[]`

### `POST /api/v1/teachers/subjects`

- Auth: Teacher only
- Description: Add subject to teacher.
- Request JSON (`AddSubjectRequest`):
  - `sub_id` (string, required, max 255)
- Response 201 (`TeacherSubjectRead`)

### `DELETE /api/v1/teachers/subjects/{entry_id}`

- Auth: Teacher only
- Description: Remove subject mapping.
- Path params:
  - `entry_id` (string)
- Response (`TeacherSubjectRead`)

### `GET /api/v1/teachers/subjects/{sub_id}/videos`

- Auth: Teacher only
- Description: List teacher demo videos for a subject.
- Path params:
  - `sub_id` (string)
- Response: `TeacherVideoRead[]`

### `POST /api/v1/teachers/subjects/{sub_id}/videos`

- Auth: Teacher only
- Description: Add demo video.
- Path params:
  - `sub_id` (string)
- Request JSON (`AddVideoRequest`):
  - `video_url` (string, required, max 500)
  - `duration_seconds` (int, required, > 0 and <= 600)
- Response 201 (`TeacherVideoRead`)

### `GET /api/v1/teachers/videos/{video_id}/access-url`

- Auth: Teacher only
- Description: Get playable access URL for a teacher video.
- Path params:
  - `video_id` (string)
- Response (`TeacherVideoAccessRead`):
  - `id`
  - `video_url`

### `GET /api/v1/teachers/availability`

- Auth: Teacher only
- Description: List availability slots (paginated).
- Query params: `skip`, `limit`
- Response: `Page[AvailabilitySlotRead]`

### `POST /api/v1/teachers/availability`

- Auth: Teacher only
- Description: Create availability slot.
- Request JSON (`AvailabilitySlotCreate`):
  - `day_of_week` (DayOfWeek)
  - `start_time` (HH:MM)
  - `end_time` (HH:MM)
- Response 201 (`AvailabilitySlotRead`)

### `PUT /api/v1/teachers/availability/{slot_id}`

- Auth: Teacher only
- Description: Update availability slot.
- Path params:
  - `slot_id` (string)
- Request JSON (`AvailabilitySlotUpdate`):
  - `day_of_week` (optional)
  - `start_time` (optional, HH:MM)
  - `end_time` (optional, HH:MM)
  - `is_active` (optional)
- Response (`AvailabilitySlotRead`)

### `DELETE /api/v1/teachers/availability/{slot_id}`

- Auth: Teacher only
- Description: Delete availability slot.
- Path params:
  - `slot_id` (string)
- Response: `204 No Content`

### `GET /api/v1/teachers/earnings`

- Auth: Teacher only
- Description: Get wallet summary.
- Response (`WalletRead`):
  - `id`, `teacher_id`, `total_earned`, `total_withdraw`, `current_balance`, `updated_at`

### `GET /api/v1/teachers/earnings/monthly`

- Auth: Teacher only
- Description: Get monthly earnings summary.
- Query params:
  - `year` (int, 2020-2100)
  - `month` (int, 1-12)
- Response (`MonthlyEarningsRead`):
  - `year`, `month`, `sessions_completed`, `amount_earned`

### `POST /api/v1/teachers/withdrawals`

- Auth: Teacher only
- Description: Request withdrawal.
- Request JSON (`WithdrawalRequest`):
  - `amount` (int, required, > 0)
- Response 201 (`WithdrawalRead`)

### `GET /api/v1/teachers/withdrawals`

- Auth: Teacher only
- Description: Get withdrawal history (paginated).
- Query params: `skip`, `limit`
- Response: `Page[WithdrawalRead]`

## 6.4 Students

### `GET /api/v1/students/profile`

- Auth: Student only
- Description: Get student profile.
- Response (`StudentProfileRead`):
  - `user_name`, `full_name`, `dob`, `gender`

### `PUT /api/v1/students/profile`

- Auth: Student only
- Description: Update student profile.
- Request JSON (`StudentProfileUpdate`):
  - `full_name` (optional, max 255)
  - `dob` (optional)
  - `gender` (optional)
- Response (`StudentProfileRead`)

## 6.5 Sessions

### `POST /api/v1/sessions/request`

- Auth: Student only
- Description: Request individual session.
- Request JSON (`SessionRequest`):
  - `teacher_id` (string)
  - `subject_master_id` (string)
  - `slot_id` (string)
  - `session_date` (date, must not be in past)
  - `topic_description` (optional, max 2000)
- Response 201 (`SessionRead`)

### `GET /api/v1/sessions/my`

- Auth: Any authenticated user
- Description: List sessions for current user.
- Query params:
  - `status` (optional, SessionStatus)
  - `skip`, `limit`
- Response: `Page[SessionRead]`

### `PUT /api/v1/sessions/{session_id}/accept`

- Auth: Teacher only
- Description: Accept a session request.
- Response (`SessionRead`)

### `PUT /api/v1/sessions/{session_id}/reject`

- Auth: Teacher only
- Description: Reject a session request.
- Response (`SessionRead`)

### `PUT /api/v1/sessions/{session_id}/propose-time`

- Auth: Teacher only
- Description: Propose substitute slot/date.
- Request JSON (`ProposeTimeRequest`):
  - `slot_id` (string)
  - `session_date` (date, must not be in past)
- Response (`SessionRead`)

### `PUT /api/v1/sessions/{session_id}/accept-substitute`

- Auth: Student only
- Description: Accept teacher's proposed substitute.
- Response (`SessionRead`)

### `PUT /api/v1/sessions/{session_id}/reject-substitute`

- Auth: Student only
- Description: Reject teacher's proposed substitute.
- Response (`SessionRead`)

### `PUT /api/v1/sessions/{session_id}/cancel`

- Auth: Student only
- Description: Cancel session.
- Response (`SessionRead`)

### `GET /api/v1/sessions/{session_id}/join`

- Auth: Any authenticated user
- Description: Join session and fetch meeting credentials.
- Response (`MeetingLinkRead`):
  - `session_id`
  - `meeting_link`
  - `jwt_token`
  - `room_name`

### `POST /api/v1/sessions/{session_id}/create-room`

- Auth: Any authenticated user
- Description: Create meeting room for session.
- Response 201 (`MeetingLinkRead`)

### `PUT /api/v1/sessions/{session_id}/complete`

- Auth: Teacher only
- Description: Mark session complete.
- Response (`SessionRead`)

### `POST /api/v1/sessions/group`

- Auth: Teacher only
- Description: Create group session.
- Request JSON (`GroupSessionCreate`):
  - `subject_master_id` (string)
  - `slot_id` (string)
  - `session_date` (date, must not be in past)
  - `max_students` (int, required, 2-100)
  - `topic_description` (optional, max 2000)
- Response 201 (`SessionRead`)

### `GET /api/v1/sessions/group/available`

- Auth: Any authenticated user
- Description: Browse open group sessions.
- Query params:
  - `subject_id` (optional)
  - `skip`, `limit`
- Response: `Page[SessionRead]`

### `PUT /api/v1/sessions/{session_id}/start`

- Auth: Teacher only
- Description: Start group session (`Open -> Accepted`).
- Response (`SessionRead`)

### `POST /api/v1/sessions/{session_id}/enroll`

- Auth: Student only
- Description: Enroll in open group session.
- Response 201 (`EnrollmentRead`)

### `DELETE /api/v1/sessions/{session_id}/enroll`

- Auth: Student only
- Description: Cancel group enrollment.
- Response: `200 OK` (service response body, if any)

### `GET /api/v1/sessions/{session_id}/enrollments`

- Auth: Any authenticated user (with service-level authorization)
- Description: List enrollments for a group session.
- Response: `EnrollmentRead[]`

## 6.6 Search

### `GET /api/v1/search`

- Auth: Any authenticated user
- Description: Search teachers by topic.
- Query params:
  - `topic` (required, min length 1)
  - `skip`, `limit`
- Response: `Page[TeacherSearchResult]`

### `GET /api/v1/search/teachers/{teacher_id}/detail`

- Auth: Any authenticated user
- Description: Get public teacher detail.
- Response (`TeacherDetailRead`)

## 6.7 Ratings

### `POST /api/v1/ratings`

- Auth: Any authenticated user
- Description: Submit rating for session.
- Request JSON (`RatingCreate`):
  - `session_id` (string)
  - `stars` (int, 1-5)
  - `review_text` (optional, max 2000)
- Response 201 (`RatingRead`)

### `GET /api/v1/ratings/pending`

- Auth: Any authenticated user
- Description: Sessions pending user rating.
- Response: `PendingRatingRead[]`

## 6.8 Payments

### `POST /api/v1/payments/orders`

- Auth: Any authenticated user
- Description: Create or fetch idempotent payment order for a session.
- Request JSON (`CreatePaymentOrderRequest`):
  - `session_id` (string)
- Response (`PaymentOrderRead`)

### `GET /api/v1/payments/transactions/{transaction_id}`

- Auth: Any authenticated user
- Description: Get payment transaction detail.
- Response (`PaymentTransactionRead`)

### `POST /api/v1/payments/webhook/{provider}`

- Auth: Public (provider-signed)
- Description: Payment provider webhook callback.
- Headers (one required):
  - `X-Payment-Signature`
  - `X-Razorpay-Signature`
- Path params:
  - `provider` (string)
- Body:
  - Raw JSON payload from provider.
- Response (`PaymentWebhookAck`):
  - `event_id`
  - `transaction_id`
  - `event_status`
  - `transaction_status`

### `GET /api/v1/payments/earnings/monthly`

- Auth: Any authenticated user
- Description: Monthly earnings breakdown.
- Query params:
  - `year` (int, 2020-2100)
  - `month` (int, 1-12)
- Response (`MonthlyEarningsRead`)

### `POST /api/v1/payments/withdrawals/process`

- Auth: Any authenticated user (intended admin/mock flow)
- Description: Mark withdrawal as success or failed.
- Request JSON (`ProcessWithdrawalRequest`):
  - `withdrawal_id` (string)
  - `success` (bool)
- Response (`WithdrawalProcessResult`)

## 6.9 Notifications

### `GET /api/v1/notifications`

- Auth: Any authenticated user
- Description: List notifications (paginated).
- Query params: `skip`, `limit`
- Response: `Page[NotificationRead]`

### `PUT /api/v1/notifications/{notification_id}/read`

- Auth: Any authenticated user
- Description: Mark notification as read.
- Path params:
  - `notification_id` (string)
- Response (`NotificationRead`)

### `GET /api/v1/notifications/unread-count`

- Auth: Any authenticated user
- Description: Get unread notification count.
- Response (`UnreadCountRead`):
  - `count`

## 7. Key Response Models (Condensed)

### 7.1 SessionRead

```json
{
  "id": "string",
  "teacher_id": "string",
  "student_id": "string|null",
  "subject_master_id": "string",
  "topic_description": "string|null",
  "slot_id": "string",
  "session_date": "YYYY-MM-DD",
  "status": "Requested|Accepted|Rejected|Rescheduled|Completed|Cancelled|Open",
  "session_type": "individual|group",
  "max_students": 0,
  "meeting_link": "string|null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 7.2 EnrollmentRead

```json
{
  "id": "string",
  "session_id": "string",
  "student_id": "string",
  "status": "string",
  "created_at": "datetime"
}
```

### 7.3 TeacherSearchResult

```json
{
  "user_name": "teacher@email.com",
  "full_name": "string|null",
  "bio": "string|null",
  "per_30_mins_charges": 0,
  "rating_avg": 0.0,
  "subjects": [
    {
      "id": "string",
      "sub_id": "string",
      "subject_name": "string"
    }
  ]
}
```

### 7.4 PaymentOrderRead

```json
{
  "transaction_id": "string",
  "gateway": "string",
  "gateway_order_id": "string",
  "status": "string",
  "session_id": "string",
  "session_type": "string",
  "payer_id": "string",
  "payee_id": "string",
  "gross_amount": 0,
  "platform_charge": 0,
  "commission_charge": 0,
  "net_payout": 0,
  "total_payable": 0,
  "currency": "INR"
}
```

## 8. Notes

- FastAPI default interactive docs should also be available unless disabled:
  - Swagger UI: `/docs`
  - OpenAPI JSON: `/openapi.json`
- Exact business-rule errors and some response body details are enforced in service layer modules under `app/services`.
