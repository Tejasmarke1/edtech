# Frontend API Integration Guide (Dockerized Backend)

This guide is for frontend developers consuming the EdTech backend APIs when backend is shared via Docker Hub image.

## 1. Backend Image Tags

Current built tags:
- `tejasmarke/edtech-backend:latest`
- `tejasmarke/edtech-backend:ebf8412`

Use commit tag (`ebf8412`) for stable testing.

## 2. Run Backend Container (API Only)

```bash
docker network create edtech-net || true

docker run -d --name edtech-postgres \
  --network edtech-net \
  -e POSTGRES_USER=edtech \
  -e POSTGRES_PASSWORD=edtech_secret \
  -e POSTGRES_DB=edtech_db \
  -p 5432:5432 \
  postgres:16-alpine

docker run -d --name edtech-redis \
  --network edtech-net \
  -p 6379:6379 \
  redis:7-alpine

docker run -d --name edtech-backend \
  --network edtech-net \
  -p 8000:8000 \
  -e APP_NAME=edtech-doubt-resolution \
  -e APP_ENV=development \
  -e APP_PORT=8000 \
  -e DEBUG=false \
  -e POSTGRES_USER=edtech \
  -e POSTGRES_PASSWORD=edtech_secret \
  -e POSTGRES_DB=edtech_db \
  -e POSTGRES_HOST=edtech-postgres \
  -e POSTGRES_PORT=5432 \
  -e DATABASE_URL=postgresql://edtech:edtech_secret@edtech-postgres:5432/edtech_db \
  -e REDIS_HOST=edtech-redis \
  -e REDIS_PORT=6379 \
  -e REDIS_URL=redis://edtech-redis:6379/0 \
  -e SECRET_KEY=replace_with_strong_secret \
  -e ALGORITHM=HS256 \
  -e ACCESS_TOKEN_EXPIRE_MINUTES=30 \
  -e REFRESH_TOKEN_EXPIRE_DAYS=7 \
  -e PLATFORM_CHARGE_PER_USER=20 \
  -e COMMISSION_PERCENT=10 \
  -e PLATFORM_CHARGE_PER_USER_INDIVIDUAL=20 \
  -e PLATFORM_CHARGE_PER_USER_GROUP=20 \
  -e COMMISSION_PERCENT_INDIVIDUAL=10 \
  -e COMMISSION_PERCENT_GROUP=10 \
  -e PAYMENT_GATEWAY=mock \
  -e PAYMENT_CURRENCY=INR \
  -e PAYMENT_GATEWAY_KEY_ID= \
  -e PAYMENT_GATEWAY_KEY_SECRET= \
  -e PAYMENT_WEBHOOK_SECRET=replace_webhook_secret \
  -e JITSI_URL=http://127.0.0.1:8080 \
  -e JITSI_APP_ID=edtech-doubt-resolution \
  -e JITSI_SECRET=replace_jitsi_secret \
  -e JITSI_DOMAIN=meet.jitsi \
  -e CORS_ORIGINS='["http://localhost:3000","http://localhost:5173"]' \
  tejasmarke/edtech-backend:ebf8412
```

Health check:

```bash
curl http://localhost:8000/health
```

## 3. API Base URL for Frontend

Use:
- `http://localhost:8000/api/v1`

Example frontend env:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 4. Authentication Contract

### Register
- `POST /auth/register`
- Body:

```json
{
  "user_name": "student@example.com",
  "password": "Str0ngP@ss!",
  "role": "student",
  "full_name": "Student Name"
}
```

### Login
- `POST /auth/login`
- Content-Type: `application/x-www-form-urlencoded`
- Fields: `username`, `password`
- Response returns `access_token` and `refresh_token`

### Auth Header

```http
Authorization: Bearer <access_token>
```

## 5. Core Session Flow for Frontend

1. Student requests session:
- `POST /sessions/request`

2. Teacher accepts session:
- `PUT /sessions/{session_id}/accept`

3. Student/teacher joins:
- `GET /sessions/{session_id}/join`
- Response includes:
  - `meeting_link`
  - `jwt_token`
  - `room_name`

4. Frontend opens meeting page using query params:
- `room`
- `jwt`
- `subject`
- `name`
- `email`
- `jitsiBaseUrl`
- `domain`

## 6. CORS Notes

If frontend runs on different origin, backend must allow it in `CORS_ORIGINS`.

Example:

```env
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","https://your-frontend-domain.com"]
```

## 7. Troubleshooting for Frontend Team

1. `401 Unauthorized`
- Token missing/expired, or wrong `Authorization` header format.

2. `403 Forbidden`
- Role mismatch (student endpoint vs teacher endpoint).

3. CORS errors in browser
- Frontend origin not listed in `CORS_ORIGINS`.

4. Join meeting issues
- Verify `jitsiBaseUrl` and `domain` are reachable from browser.
- If HTTPS self-signed cert is used, trust certificate first.

## 8. Recommended Shared Workflow

1. Backend owner publishes image tag per backend release.
2. Frontend team pins exact image tag for QA/staging.
3. API contract changes are communicated with endpoint diff and example payloads.
