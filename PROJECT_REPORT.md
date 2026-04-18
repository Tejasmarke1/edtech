# PROJECT REPORT

## YES Doubt-Resolution Platform

### Submitted By
- Name: ____________________
- Roll Number: ____________________
- Department: ____________________
- Semester/Year: ____________________

### Submitted To
- Guide/Faculty Name: ____________________
- College Name: ____________________
- Submission Date: 12 April 2026

---

## Certificate

This is to certify that the project work titled "YES Doubt-Resolution Platform" is a bonafide record of work carried out by the above student under the supervision of the faculty guide, in partial fulfillment of the requirements for the award of the degree.

- Guide Signature: ____________________
- HOD Signature: ____________________
- External Examiner Signature: ____________________

## Acknowledgement

I express sincere gratitude to my project guide, department faculty, and institution for their continuous support and guidance. I also thank my peers for their valuable suggestions during requirement analysis, development, and testing phases.

## Abstract

This project implements a full-stack EdTech solution for real-time doubt resolution between students and teachers. The platform enables role-based authentication, teacher discovery, one-to-one and group session scheduling, payment processing, and live meeting participation through Jitsi integration. The backend is implemented using FastAPI with SQLAlchemy and PostgreSQL, while the frontend uses React and Vite for responsive user experience. The system is designed with modular layering (router, service, repository, and database) to ensure maintainability and scalability.

The project includes automated testing across API and browser flows, secure token-based authentication, pagination support in list endpoints, and payment transaction lifecycle management. Overall, the system demonstrates practical full-stack engineering skills and addresses a relevant educational problem with a deployable software architecture.

## Table of Contents

1. Introduction
2. Problem Statement
3. Objectives
4. Scope
5. Literature and Technology Context
6. System Requirements
7. System Design and Architecture
8. Database Schema
9. Module-Wise Implementation Details
10. API Design Summary
11. Frontend Design and User Flows
12. Testing Strategy and Results
13. Deployment and Operations
14. Security and Reliability Review
15. Challenges and Resolutions
16. Learning Outcomes
17. Limitations
18. Future Enhancements
19. Conclusion
20. References
21. Appendix

## 1. Introduction

Digital learning environments require immediate support mechanisms where students can ask subject-specific doubts and receive expert guidance without delay. Traditional doubt-clearing channels are often asynchronous and do not guarantee real-time interaction. This project addresses that gap by building an interactive platform where students can discover teachers, book sessions, and join live meeting rooms.

The YES Doubt-Resolution Platform is designed as a role-based marketplace and session management system with integrated payments. The solution attempts to balance user experience, maintainable backend architecture, and realistic deployment practices.

## 2. Problem Statement

Students face delays and inconsistency in doubt resolution due to:

1. Limited direct access to experts at the time of need.
2. Poor discoverability of suitable teachers by topic.
3. Lack of integrated booking, payment, and live session workflows.
4. Fragmented systems that force users to use multiple tools.

Hence, there is a need for a unified platform that provides end-to-end doubt resolution in one system.

## 3. Objectives

1. Build secure, role-based authentication for students and teachers.
2. Allow teachers to manage profile, subjects, videos, and availability.
3. Enable students to search teachers and book individual or group sessions.
4. Integrate payment order creation, verification, and webhook processing.
5. Provide live session join flow via meeting links.
6. Maintain clean architecture and include meaningful automated tests.

## 4. Scope

### In Scope

1. User registration and login.
2. Teacher onboarding and profile management.
3. Session scheduling and status workflow.
4. Group session publish and enrollment.
5. Payment tracking and wallet-related operations.
6. Notification and rating related modules.

### Out of Scope

1. Native mobile application.
2. Advanced analytics dashboards.
3. AI-based teacher recommendation.
4. Full production-grade observability stack.

## 5. Literature and Technology Context

This implementation aligns with contemporary web architecture patterns:

1. REST API approach for modular backend services.
2. Token-based stateless authentication for scalable access management.
3. Layered backend architecture to improve testability and maintainability.
4. SPA frontend architecture for better user interactivity.
5. Container-based local deployment for reproducibility.

The chosen stack (FastAPI + React + PostgreSQL + Docker) is widely used in modern product engineering due to strong ecosystem support and development speed.

## 6. System Requirements

### Hardware Requirements (Minimum)

1. CPU: Dual-core processor
2. RAM: 8 GB
3. Storage: 10 GB free
4. Network: Stable internet for video session usage

### Software Requirements

1. Operating System: Windows/Linux/macOS
2. Python: 3.11+ environment
3. Node.js: Modern LTS for frontend tooling
4. PostgreSQL and Redis (or Docker Compose stack)
5. Browser: Chromium-based or Firefox latest versions

## 7. System Design and Architecture

### 7.1 High-Level Architecture

The system is organized into four principal layers:

1. Presentation Layer (React frontend)
2. API Layer (FastAPI routers)
3. Business Layer (service modules)
4. Data Layer (repositories with SQLAlchemy models)

### 7.2 Backend Structural Pattern

1. Routers perform request parsing and endpoint declaration.
2. Services implement domain logic and validations.
3. Repositories isolate query and persistence concerns.
4. Schemas provide request/response contracts.

### 7.3 Core Backend Modules

1. Auth
2. Teachers
3. Students
4. Sessions
5. Search
6. Payments and Wallet
7. Notifications
8. Ratings

### 7.4 Frontend Structural Pattern

1. Feature-based folder organization
2. Route guards for authenticated and role-based flows
3. API client abstraction
4. Reusable components and hooks
5. Centralized auth state store

## 8. Database Schema

The database is relational and normalized around the main platform workflows: users, teacher data, sessions, payments, notifications, and enrollment tracking. The schema is managed through SQLAlchemy ORM models and Alembic migrations.

### 8.1 Core Tables

| Table | Purpose | Primary Key | Important Columns |
|---|---|---|---|
| `user` | Stores login identity and role | `user_name` | `password`, `is_verified`, `role`, timestamps |
| `user_profile` | Stores extended user details | `user_name` | `full_name`, `dob`, `gender` |
| `teacher_profile` | Stores teacher-specific profile data | `user_name` | `bio`, `per_30_mins_charges`, `group_per_student_charges`, `upi_id` |
| `subject` | Subject master list | `sub_id` | `name` |
| `teacher_subject_master_list` | Links teachers to subjects | `id` | `user_name`, `sub_id`, `is_active` |
| `teacher_video_demo` | Teacher demo videos by subject | `id` | `user_name`, `sub_id`, `video_url`, `duration_seconds` |
| `availability_slots` | Teacher time slots | `id` | `user_name`, `day_of_week`, `start_time`, `end_time`, `is_active` |
| `session_schedule` | Session booking and lifecycle data | `id` | `teacher_id`, `student_id`, `subject_master_id`, `slot_id`, `session_type`, `session_date`, `status`, `meeting_link`, `room_name` |
| `session_enrollment` | Group session enrollment records | `id` | `session_id`, `student_id`, `status` |
| `payment_transaction` | Payment lifecycle for each session | `id` | `session_id`, `payer_id`, `payee_id`, `gross_amount`, `platform_charge`, `commission_charge`, `net_payout`, `gateway_order_id`, `gateway_payment_id`, `status` |
| `payment_event` | Gateway webhook/event audit log | `id` | `gateway`, `event_id`, `event_type`, `status`, `payload`, `transaction_id` |
| `teacher_wallet` | Teacher earnings ledger | `id` | `teacher_id`, `total_earned`, `total_withdraw`, `current_balance` |
| `withdrawal` | Withdrawal request tracking | `id` | `teacher_id`, `amount`, `status`, `request_at`, `processed_at`, gateway metadata |
| `rating` | Session rating and review data | `id` | `session_id`, `rated_by`, `stars`, `review_text` |
| `notification` | In-app notification store | `id` | `user_name`, `type`, `title`, `message`, `is_read`, `reference_id` |

### 8.2 Important Relationships

1. `user` to `user_profile`: one-to-one.
2. `user` to `teacher_profile`: one-to-one for teacher accounts.
3. `user` to `teacher_subject_master_list`: one-to-many.
4. `subject` to `teacher_subject_master_list`: one-to-many.
5. `teacher_subject_master_list` to `session_schedule`: one-to-many.
6. `availability_slots` to `session_schedule`: one-to-many.
7. `user` to `session_schedule`: one teacher and optionally one student per session.
8. `session_schedule` to `session_enrollment`: one-to-many for group sessions.
9. `session_schedule` to `payment_transaction`: one-to-many.
10. `payment_transaction` to `payment_event`: one-to-many.
11. `user` to `teacher_wallet`: one-to-one.
12. `user` to `withdrawal`: one-to-many.
13. `session_schedule` to `rating`: one-to-many.
14. `user` to `notification`: one-to-many.

### 8.3 Enumerated Fields

The schema uses enums to keep important state values consistent.

1. `UserRole`: `student`, `teacher`
2. `Gender`: `male`, `female`, `other`
3. `DayOfWeek`: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`
4. `SessionStatus`: `Requested`, `Accepted`, `Rejected`, `Rescheduled`, `Completed`, `Cancelled`, `Open`
5. `SessionType`: `individual`, `group`
6. `EnrollmentStatus`: `enrolled`, `cancelled`
7. `WithdrawalStatus`: `requested`, `processing`, `success`, `failed`
8. `PaymentGateway`: `mock`, `razorpay`, `stripe`
9. `PaymentStatus`: `created`, `authorized`, `captured`, `failed`, `refunded`
10. `PaymentEventStatus`: `received`, `processed`, `ignored`, `failed`
11. `NotificationType`: session and payment related event types such as `session_request`, `session_accepted`, `session_completed`, `payment_received`, and `withdrawal_processed`

### 8.4 Schema Design Considerations

1. Alembic manages schema changes through versioned migrations.
2. Primary keys are string-based identifiers to keep record creation flexible across modules.
3. Foreign keys enforce referential integrity between users, sessions, payments, and teacher data.
4. Unique constraints are used where duplicate business events are not allowed, such as payment idempotency and enrollment uniqueness.
5. Nullable fields are used where workflow stages may not yet be complete, such as `student_id` for group sessions or `gateway_payment_id` before payment capture.
6. Timestamp mixins are used consistently so auditability is built into nearly every table.

## 9. Module-Wise Implementation Details

### 9.1 Authentication Module

1. Register endpoint for student and teacher roles.
2. Login endpoint returning access and refresh tokens.
3. Refresh token exchange support.
4. Protected profile endpoint for authenticated users.

### 9.2 Teacher Module

1. Profile read and update operations.
2. Subject add/remove functionality.
3. Demo video management for subjects.
4. Availability slot CRUD operations.
5. Earnings and withdrawal history operations.

### 9.3 Student Module

1. Search teacher by topic or subject context.
2. View teacher details.
3. Request sessions and track status.
4. Enroll in open group sessions.

### 9.4 Sessions Module

Session lifecycle includes:

1. Requested
2. Accepted or Rejected
3. Rescheduled or Cancelled
4. Completed

Group session lifecycle adds:

1. Open state for enrollment
2. Teacher start action
3. Enrollment view and cancellation flows

### 9.5 Payment Module

1. Order creation with idempotent behavior.
2. Checkout signature verification support.
3. Webhook ingestion and signature validation.
4. Transaction listing with pagination.
5. Earnings aggregation and withdrawal reconciliation operations.

### 9.6 Notifications and Ratings

1. Event-driven notification categories for session and payment events.
2. Rating prompts and feedback persistence workflows.

## 10. API Design Summary

### 10.1 API Style

1. RESTful endpoint naming under `/api/v1`.
2. JSON request/response contracts using schema models.
3. Common pagination shape using `items`, `total`, `skip`, and `limit`.

### 10.2 Endpoint Domains

1. Health
2. Auth
3. Teachers
4. Students
5. Sessions
6. Search
7. Payments
8. Notifications
9. Ratings

### 10.3 API Quality Attributes

1. Typed schema contracts
2. Role-based endpoint protections
3. Consistent error handling through HTTP codes
4. Pagination for scalable list retrieval

## 11. Frontend Design and User Flows

### 11.1 Frontend Responsibilities

1. Authentication UI and route guards
2. Student dashboard and session booking interfaces
3. Teacher dashboard and session management screens
4. Notification and payment interaction elements
5. Meeting-page redirection flow

### 11.2 Primary User Flows

1. Student Flow
- Register/Login
- Discover teacher
- Request/book session
- Complete payment
- Join meeting

2. Teacher Flow
- Register/Login
- Complete onboarding/profile updates
- Manage subjects and availability
- Accept/reject sessions
- Conduct and complete sessions

## 12. Testing Strategy and Results

### 12.1 Test Layers

1. In-process API tests using test client and isolated database setup.
2. Integration tests using HTTP clients.
3. Browser-level tests using Playwright for end-user flows.

### 12.2 Executed Command

` .venv/Scripts/python.exe -m pytest -q `

### 12.3 Observed Outcome

1. Passed: 98
2. Failed: 21
3. Errors: 7

### 12.4 Analysis

1. Majority of business-logic and API behavior checks are passing.
2. Most failures are environment-dependent integration/browser tests when local services are not running.
3. Async fixture style should be updated for future pytest compatibility.

## 13. Deployment and Operations

### 13.1 Deployment Approach

1. Docker Compose orchestrates backend app, worker, PostgreSQL, Redis, and Jitsi services.
2. Backend startup script runs migration command before service start.

### 13.2 Operational Notes

1. Local development experience is straightforward due to compose setup.
2. Production deployment requires stronger secrets management, restricted ports, and safer migration strategy.

## 14. Security and Reliability Review

### 14.1 Positive Aspects

1. JWT-based auth and role checks are implemented.
2. Payment signatures/webhook verification flow is included.
3. Structured layers reduce accidental logic duplication.

### 14.2 Improvement Areas

1. Harden compose defaults for secrets and exposed ports.
2. Use strict CORS origin lists in production.
3. Move migration execution to controlled deployment stage.
4. Add CI pipeline to formalize test stages and environment setup.

## 15. Challenges and Resolutions

### 15.1 Challenge: Coordinating Multi-Service Stack

Issue: API, DB, cache, worker, and meeting services must align for complete flows.

Resolution: Compose-based setup and clear service boundaries simplify local orchestration.

### 15.2 Challenge: Complex Session Workflows

Issue: Session state transitions (request, accept, reject, complete) require strict validation.

Resolution: Domain logic centralized in service layer with explicit status handling.

### 15.3 Challenge: Payment Integrity

Issue: Need trustworthy transaction processing.

Resolution: Signature verification and webhook acknowledgment implemented in payment module.

## 16. Learning Outcomes

Through this project, the following practical outcomes were achieved:

1. Designing maintainable backend architecture with clear layering.
2. Building role-based secure web APIs.
3. Implementing frontend route guards and state management.
4. Integrating external systems (payments and meeting stack).
5. Writing and interpreting multi-layer automated tests.
6. Identifying and documenting deployment security concerns.

## 17. Limitations

1. Browser integration tests require runtime setup of multiple local services.
2. Performance benchmarking report is not yet included.
3. Advanced observability (tracing/metrics dashboards) is limited.
4. Mobile-native client is not part of current scope.

## 18. Future Enhancements

1. Implement CI/CD with staged test execution.
2. Add load testing and benchmark report.
3. Introduce monitoring dashboards and alerting.
4. Improve production hardening profile and secret management.
5. Add recommendation engine for better teacher discovery.
6. Build dedicated mobile application.

## 19. Conclusion

The YES Doubt-Resolution Platform demonstrates a complete and practical full-stack academic project with real-world relevance. It successfully integrates authentication, scheduling, payment, and live interaction workflows into a single coherent system. The current implementation is strong for development and staged deployment use, and it can be advanced to production maturity through focused security hardening, CI orchestration, and performance optimization.

## 20. References

1. FastAPI Documentation: https://fastapi.tiangolo.com/
2. React Documentation: https://react.dev/
3. SQLAlchemy Documentation: https://docs.sqlalchemy.org/
4. Alembic Documentation: https://alembic.sqlalchemy.org/
5. Docker Documentation: https://docs.docker.com/
6. PostgreSQL Documentation: https://www.postgresql.org/docs/
7. Redis Documentation: https://redis.io/docs/
8. Jitsi Handbook: https://jitsi.github.io/handbook/

## 21. Appendix

### Appendix A: Suggested Viva Questions

1. Why did you choose FastAPI instead of Django?
2. How are session state transitions controlled safely?
3. How does payment signature verification protect integrity?
4. Why is layered architecture useful in this project?
5. What are the main bottlenecks for scaling this platform?

### Appendix B: Sample Execution Commands

1. Backend tests:
	`.venv/Scripts/python.exe -m pytest -q`
2. Run backend (local):
	`poetry run uvicorn app.main:app --reload --port 8000`
3. Run frontend (local):
	`npm run dev`
4. Run compose stack:
	`docker compose up -d`
