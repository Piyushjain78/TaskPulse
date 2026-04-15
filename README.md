# TaskPulse

Production-oriented task management with **JWT auth**, **RBAC**, **strict task state machine**, **server-authoritative timers**, **threaded comments**, **Socket.io notifications**, and **WhatsApp** delivery via Msg91 or Gupshup.

## How to run this project

### Prerequisites

- **Docker Desktop** (or another Docker engine with Compose v2) installed and **running**.
- Ports **5432** (Postgres), **4000** (API), and **5173** (web UI) available on your machine, or change them in `.env` (`POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`).

### 1. Get the code and configure environment

```bash
git clone <repository-url>
cd TaskPulse
cp .env.example .env
```

Edit **`.env`** before the first run:

| Variable | Notes |
|----------|--------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **Required.** Each must be at least **32 characters**. Change the example values for anything beyond local testing. |
| `VITE_API_URL` / `VITE_WS_URL` | For the **Docker** setup, keep **`http://localhost:4000`** so the browser on your host can reach the API (these are baked into the frontend image at **build** time). |
| `CORS_ORIGIN` | Should include the UI origin, e.g. **`http://localhost:5173`**. |
| `WHATSAPP_PROVIDER` | Use **`none`** until Msg91/Gupshup is configured (see [WhatsApp setup](#whatsapp-setup)). |

The backend container **overrides** `DATABASE_URL` to point at the `postgres` service; you do not need to edit `DATABASE_URL` for Compose unless you run the backend **outside** Docker (see below).

### 2. Start everything with Docker Compose (recommended)

From the **repository root**:

```bash
docker compose up --build
```

On first start the backend image will:

1. Run **`prisma migrate deploy`** (apply migrations).
2. Run **`prisma db seed`** (create users and sample tasks).
3. Start the API on port **4000**.

The frontend is served on port **5173** (nginx inside the container).

**Open the app:** [http://localhost:5173](http://localhost:5173)

Sign in with a [seeded account](#seeded-users) (e.g. `manager1@test.com` / `password123`).

**Stop:** press `Ctrl+C`, or run `docker compose down` in another terminal. To also remove the database volume: `docker compose down -v` (this **deletes** Postgres data).

### 3. Run locally without Docker (optional, for development)

Use this if you want hot reload and to run Node on the host while still using Docker only for Postgres.

1. Start **Postgres** only:

   ```bash
   docker compose up postgres -d
   ```

2. In **`.env`**, set **`DATABASE_URL`** to match your host connecting to the exposed port, for example:

   `postgresql://taskpulse:taskpulse@localhost:5432/taskpulse?schema=public`

   (Adjust user/password/db if you changed `POSTGRES_*` in `.env`.)

3. **Backend** (new terminal):

   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npx prisma db seed
   npm run dev
   ```

   API: [http://localhost:4000](http://localhost:4000) — try [http://localhost:4000/health](http://localhost:4000/health).

4. **Frontend** (another terminal):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Vite dev server: [http://localhost:5173](http://localhost:5173). The Vite config proxies `/api` and `/socket.io` to the backend when `VITE_API_URL` is unset or points at localhost; set **`VITE_API_URL=http://localhost:4000`** in `.env` at repo root or in `frontend/.env` if the UI cannot reach the API.

### 4. Check that it is working

- UI loads and **login** succeeds with a seeded user.
- **http://localhost:4000/health** returns `{"ok":true}` (Docker or local backend).
- After login, the **notification bell** can connect (Socket.io uses the same JWT as the REST API).

### Common issues

| Symptom | What to try |
|--------|--------------|
| `Cannot connect to the Docker daemon` | Start **Docker Desktop** (or your Docker service) and retry. |
| Backend exits on “Invalid environment configuration” | Ensure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set and **≥ 32 characters** in `.env`. |
| Frontend loads but API calls fail | Confirm **`VITE_API_URL`** / **`VITE_WS_URL`** match how you open the app (for Docker, **`http://localhost:4000`**). Rebuild the frontend image after changing them: `docker compose up --build frontend`. |
| Port already in use | Change `BACKEND_PORT`, `FRONTEND_PORT`, or `POSTGRES_PORT` in `.env` and ensure `DATABASE_URL` / URLs stay consistent for local runs. |
| Stale database state | `docker compose down -v` then `docker compose up --build` (removes the Postgres volume — **data loss**). |

## Architecture

- **Backend** (`backend/`): Node.js, **Express**, **TypeScript**, **Prisma**, **PostgreSQL**, **JWT** (access + refresh), **Socket.io** on the same HTTP server.
- **Frontend** (`frontend/`): **React 18**, **Vite**, **TypeScript**, **Tailwind CSS**, **Zustand** for auth and notification UI state.
- **Notifications**: Central `NotificationService` (`backend/src/services/notification.service.ts`) persists rows, emits over Socket.io, and triggers WhatsApp when applicable. Business logic stays out of route handlers; services own validation and orchestration.
- **WhatsApp**: `WhatsAppService` (`backend/src/modules/whatsapp/whatsapp.service.ts`) sends template-style payloads, logs outcomes in `DeliveryLog`, and never crashes the request path on provider errors.

### RBAC

| Role      | Task visibility |
|-----------|------------------|
| **MANAGER** | Tasks they **created** or assigned to their **direct reports** (`assignee.managerId`). |
| **EMPLOYEE** | Only tasks **assigned** to them. |

Employees cannot create tasks. Managers create tasks and pick assignees from **their** employees only.

### Task state machine (backend-enforced)

Valid transitions:

1. **PENDING** or **RETURNED** → **IN_PROGRESS** (assignee **START**).
2. **IN_PROGRESS** → **COMPLETED** (assignee **COMPLETE**); timer is finalized.
3. **COMPLETED** → **APPROVED** (manager **APPROVE**).
4. **COMPLETED** → **RETURNED** (manager **RETURN**; **comment required**). A system-style comment is stored automatically.

Any other transition returns **400** with an error message.

### Timer

- Segments are stored in `TimeLog` (`startTime`, `endTime`).
- **START** creates an open segment and sets `timerRunState` / `activeSegmentStart`.
- **PAUSE** / **RESUME** only while status is **IN_PROGRESS**; multiple tabs are reconciled by collapsing duplicate open segments server-side.
- Reported **total** time = sum of **closed** segments + live elapsed for the **current** open segment (no double counting).

## WhatsApp setup

1. Choose **Msg91** or **Gupshup** and set `WHATSAPP_PROVIDER` in `.env` to `msg91` or `gupshup`. Use `none` to skip outbound WhatsApp (delivery attempts are still logged as `skipped` where appropriate).
2. **Msg91**: Create WhatsApp templates matching your placeholders. Set:
   - `MSG91_AUTH_KEY`
   - `MSG91_WHATSAPP_INTEGRATED_NUMBER`
   - `MSG91_TEMPLATE_NAMESPACE` (if required by your account)
   - `MSG91_TEMPLATE_TASK_ASSIGNED`, `MSG91_TEMPLATE_TASK_COMPLETED` (template names)
3. **Gupshup**: Set `GUPSHUP_USER_ID`, `GUPSHUP_PASSWORD`, and optionally `GUPSHUP_APP_NAME` for sandbox.
4. Ensure users have **`phone`** in E.164 format (seed data includes sample numbers). Without a phone, sends are logged as `skipped`.

Delivery attempts are recorded in **`DeliveryLog`** (`status`, `provider`, `payload`, `error`).

## Seeded users

| Email | Password | Role |
|-------|----------|------|
| manager1@test.com | password123 | MANAGER |
| manager2@test.com | password123 | MANAGER |
| employee1@test.com | password123 | EMPLOYEE (reports to manager1) |
| employee2@test.com | password123 | EMPLOYEE (reports to manager1) |
| employee3@test.com | password123 | EMPLOYEE (reports to manager2) |

## API overview

- `POST /api/auth/login`, `POST /api/auth/refresh`
- `GET /api/tasks` — filters: `status`, `priority`, `sortBy`, `sortDir`
- `POST /api/tasks` — manager only
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/transition` — `{ action, comment? }`
- `POST /api/tasks/:id/timer` — `{ action: "PAUSE" | "RESUME" }`
- `GET/POST /api/tasks/:id/comments`
- `GET /api/users/employees` — manager only (assignee dropdown)
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`

Socket.io: connect with `auth: { token: <access JWT> }`; server emits `notification` payloads matching persisted notifications.

## Technical decisions

- **Zod** for DTO validation at the edge (routes parse, services execute).
- **Single HTTP server** hosts Express and Socket.io (same origin / CORS config).
- **Refresh tokens** are stateless JWTs; rotate on `/refresh` for simplicity (no server-side session store).
- **Prisma migrations** ship in-repo; Docker entrypoint runs `migrate deploy` then `db seed` then `node dist/server.js`.

## Known limitations

- **RETURNED → IN_PROGRESS** is allowed for rework (assignee **START**); the linear diagram in the spec is extended for a realistic rework loop.
- **WhatsApp** templates must match your provider account; payload shape may need small adjustments for your approved template variable order.
- **JWT refresh** does not maintain a server-side revocation list; stolen refresh tokens remain valid until expiry unless you add a denylist/DB store.

## AI usage

This repository was scaffolded and implemented with assistance from an AI coding agent: schema design, service layout, Docker wiring, and UI were generated iteratively and reviewed for consistency with the stated requirements.
