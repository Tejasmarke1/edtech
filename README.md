# YES Doubt-Resolution Platform - Backend

FastAPI backend for the YES EdTech doubt-resolution platform connecting students with teachers for live 1-on-1 sessions with Jitsi Meet video calling.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| Task Queue | Celery |
| Video | Jitsi Meet (self-hosted, JWT auth) |
| Deps | Poetry |
| Containers | Docker Compose |

## Quick Start (Docker - recommended for testers)

**Prerequisites:** Docker Desktop installed and running.

```bash
# 1. Clone and enter the project
git clone <repo-url> && cd Edtech

# 2. Create your .env file
cp .env.example .env        # edit values if needed (defaults work locally)

# 3. Start everything (backend + DB + Redis + Jitsi)
docker compose up -d

# 4. Run one-time post-start setup (Jitsi nginx/JVB config)
# On Windows PowerShell:
powershell scripts/post-start.ps1
# On Linux/Mac:
bash scripts/post-start.sh

# 5. Verify
curl http://localhost:8000/health    # should return {"status":"ok"}
```

**Services after startup:**

| Service | URL |
|---------|-----|
| API (Swagger docs) | http://localhost:8000/docs |
| API (ReDoc) | http://localhost:8000/redoc |
| Jitsi Meet | https://localhost:8443 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

> **Note:** Jitsi uses a self-signed certificate. Accept the browser warning when first visiting https://localhost:8443.
> If participants join from another device and see internet/disconnected warnings, set `JVB_ADVERTISE_IPS` in `.env` to your host machine IPv4 (not `127.0.0.1`), then run `docker compose up -d --build`.

## Local Development (without Docker for app)

```bash
# 1. Install dependencies
poetry install

# 2. Start infrastructure only
docker compose up -d postgres redis

# 3. Run migrations
poetry run alembic upgrade head

# 4. Start the app
poetry run uvicorn app.main:app --reload --port 8000
```

## Project Structure

```
app/
  main.py              # FastAPI entry-point
  config.py            # Pydantic Settings
  database.py          # Engine and session factory
  dependencies.py      # Shared DI (get_db, get_current_user)
  models/              # SQLAlchemy ORM models
  schemas/             # Pydantic request/response schemas
  routers/             # API route handlers
  services/            # Business logic
  repositories/        # DB query layer
  utils/               # Helpers (security, pagination, exceptions)
  tasks/               # Celery background tasks
alembic/               # DB migration scripts
scripts/               # Post-start and utility scripts
tests/                 # Pytest test suite (70 passing)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. See the file for all available settings.

## API Docs

Once running, interactive docs are available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Stopping

```bash
docker compose down           # stop all containers
docker compose down -v        # stop and delete volumes (resets database)
```