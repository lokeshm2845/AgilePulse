# AgilePulse – Agile Project Management Tool

**Student:** Lokesh Magare · **Roll No:** B292 · **Batch:** A2
**Subject:** Software Engineering Lab · **Guide:** Dr. Naziya Hussain

AgilePulse is a web-based Scrum tool with role-based access control, a product
backlog with Fibonacci story points, sprint planning with velocity caps, a
drag-and-drop Kanban board with workflow validation, and real-time sync of the
board across every open dashboard via Socket.IO.

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | React 18 + Vite + TailwindCSS 3              |
| Backend    | Node.js + Express                            |
| Database   | MongoDB Atlas + Mongoose                     |
| Auth       | JWT in HttpOnly cookie + bcryptjs (10 rounds) |
| Real-time  | Socket.IO                                    |
| Testing    | Jest + Supertest + mongodb-memory-server     |

---

## 1. Quick start

Requires **Node.js 18+**.

### Option A – Demo mode (no Atlas account needed)

Runs the API on a temporary in-memory MongoDB pre-loaded with demo data.
Data is lost when the server stops.

```bash
cd backend
npm install
npm run demo
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with a demo account
(password for all: `password123`):

| Role           | Email                 |
|----------------|-----------------------|
| Product Owner  | po@agilepulse.dev     |
| Scrum Master   | sm@agilepulse.dev     |
| Developer      | dev@agilepulse.dev    |
| Developer      | dev2@agilepulse.dev   |

### Option B – MongoDB Atlas

1. Edit `backend/.env` and put your real Atlas connection string in `MONGO_URI`
   and a long random string in `JWT_SECRET` (see `backend/.env.example`).
   In Atlas → *Network Access*, allow your IP address.
2. ```bash
   cd backend
   npm install
   npm run seed     # optional: demo users + sprint + stories
   npm run dev      # http://localhost:5000
   ```
3. Start the frontend as above (`npm run dev` in `frontend/`).

> `.env` is in `.gitignore` – never commit real credentials.

### Option C – Production mode on your PC

Builds the React app and serves everything (API + Socket.IO + UI) from one server,
exactly as it runs when deployed:

```bash
npm run build                      # in agilepulse/ (root)
npm run demo:prod --prefix backend # in-memory DB, http://localhost:5000
```

---

## 1a. Environment variables (`backend/.env`)

| Variable | Local value | Production value | What it does |
|----------|-------------|------------------|--------------|
| `PORT` | `5000` | *(set by host)* | Port the server listens on |
| `NODE_ENV` | `development` | `production` | Production = secure cookies + serves the React build |
| `MONGO_URI` | your Atlas string | same Atlas string | Database connection |
| `JWT_SECRET` | random 64+ chars | a **different** random 64+ chars | Signs login tokens. Anyone who knows it can forge logins |
| `CLIENT_URL` | `http://localhost:5173` | your site URL, e.g. `https://agilepulse.onrender.com` | Allowed browser origin(s) for CORS + Socket.IO (comma-separated) |
| `COOKIE_SAMESITE` | *(unset)* | *(unset)* | Only set to `none` if the frontend lives on a **different** domain |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Getting `MONGO_URI` from MongoDB Atlas (free):**
1. https://cloud.mongodb.com → create a free **M0** cluster.
2. *Database Access* → **Add New Database User** (username + password; avoid `@ : / ? #` in the password or URL-encode them).
3. *Network Access* → **Add IP Address** → `0.0.0.0/0` (needed for Render, whose IPs change) – or just your IP for local use.
4. *Database* → **Connect** → *Drivers* → copy the string and fill it in:
   `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/agilepulse?retryWrites=true&w=majority`
   (note the `/agilepulse` database name before the `?`).

The server refuses to start (with a clear message) if `MONGO_URI` still contains
the placeholder or if `JWT_SECRET` is weak in production.

---

## 1b. Deploying to Render (free, one service, real-time works)

The backend serves the built React app, so **one Render web service** hosts the
API, the WebSockets and the UI on a single HTTPS domain. Cookies are first-party
and Socket.IO needs no extra configuration.

1. Push the `agilepulse/` folder to a GitHub repository (`.env` is git-ignored).
2. Render → **New → Blueprint** → choose the repo. `render.yaml` configures:
   build `npm run build`, start `npm start`, health check `/api/health`,
   `NODE_ENV=production`, auto-generated `JWT_SECRET`.
   *(Or New → Web Service with the same build/start commands.)*
3. When asked, enter `MONGO_URI` (Atlas string) and `CLIENT_URL`
   (the URL Render shows, e.g. `https://agilepulse.onrender.com`).
4. After the first deploy, seed demo data once from your PC (optional):
   put the same `MONGO_URI` in your local `.env` and run `npm run seed --prefix backend`.
5. Open the URL in two browsers, sign in as two users, move a card – both update live.

Notes:
* HTTPS/TLS is provided by Render automatically (NFR-08).
* The free plan sleeps after ~15 min idle; the first request then takes ~30–50 s.
* Railway / Fly.io / a VPS work the same way: `npm run build` then `npm start`, with the env vars above.

### Optional: frontend on Vercel, API on Render
Set on the API: `CLIENT_URL=https://your-app.vercel.app`, `COOKIE_SAMESITE=none`.
Set on Vercel: `VITE_API_URL=https://your-api.onrender.com/api`,
`VITE_SOCKET_URL=https://your-api.onrender.com`, plus a rewrite of all routes to `/index.html`.
(Some browsers block cross-site cookies, which is why the single-service setup is recommended.)

---

## 2. Running the tests

```bash
cd backend
npm test                 # run all suites
npm run test:coverage    # with coverage report (target ≥ 80 %)
```

Tests use an in-memory MongoDB, so they never touch Atlas.

| Suite               | What it covers |
|---------------------|----------------|
| `auth.test.js`      | register, duplicate email, login, wrong password / unknown email (401), account lock after 3 failures, missing / invalid / expired token (401), logout |
| `workflow.test.js`  | `validateTransition()` unit tests + API: To-Do→In Progress (200), To-Do→Done (400), In Progress→To-Do (400), only DEV may move cards |
| `task.test.js`      | GET / POST / PUT / DELETE `/api/tasks`, Fibonacci validation, RBAC, capacity checks |
| `sprint.test.js`    | sprint CRUD, close sprint, single active sprint, velocity cap ("Sprint Capacity Exceeded") |
| `backlog.test.js`   | PO-only backlog CRUD, priority ordering |
| `socket.test.js`    | two clients receive `taskUpdated` within 1.5 s of a move (NFR-01); sockets without a JWT are rejected |
| `activity.test.js`  | activity log API, live `activity` + `presence` events |

---

## 3. Project structure

```
agilepulse/
├── backend/
│   ├── server.js              # entry point: env, DB, Socket.IO, listen
│   ├── app.js                 # Express app (routes, CORS, errors) – imported by tests
│   ├── seed.js / demo.js      # demo data / in-memory demo mode
│   ├── config/db.js           # Mongo connection with retry
│   ├── models/                # User, Project, Sprint, Task, ActivityLog
│   ├── controllers/           # auth, task, sprint, backlog logic
│   ├── routes/                # REST endpoints
│   ├── middleware/            # authMiddleware (JWT + RBAC), errorMiddleware
│   ├── services/socketService.js
│   ├── utils/                 # workflow rules, sprint capacity, activity log
│   └── tests/
└── frontend/
    └── src/
        ├── App.jsx            # routes
        ├── context/AuthContext.jsx
        ├── services/api.js    # axios instance + all API calls
        ├── services/socket.js # Socket.IO client
        ├── utils/constants.js
        └── components/        # Login, Register, Layout, KanbanBoard, Column,
                               # TaskCard, Backlog, SprintManager, Alert
```

### Data model note

A **user story and a task are the same `Task` document**:
`sprintId = null` → it is in the Product Backlog;
`sprintId = <id>` → it is committed to that sprint and appears on the Kanban board.

---

## 4. API reference

All endpoints except register / login / logout / health require a valid JWT
(HttpOnly `token` cookie, or `Authorization: Bearer <token>` header for Postman).

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | public | `{ name, email, password, role }` |
| POST | `/api/auth/login` | public | `{ email, password }` → sets cookie, returns `{ user, token }` |
| POST | `/api/auth/logout` | public | clears the cookie |
| GET  | `/api/auth/me` | any | current user |
| GET  | `/api/auth/users` | any | list users (for assigning tasks) |
| GET  | `/api/tasks?sprintId=` | any | tasks (optionally of one sprint) |
| POST | `/api/tasks` | PO, SM | create task |
| PUT  | `/api/tasks/:id` | DEV for `status`; PO/SM for other fields | drag-and-drop / edit |
| DELETE | `/api/tasks/:id` | PO, SM | delete task |
| GET  | `/api/sprints` | any | sprints with `committedPoints` |
| POST | `/api/sprints` | SM | `{ name, startDate, endDate, velocityCapacity }` |
| PUT  | `/api/sprints/:id` | SM | edit / start (`status: "Active"`) / close (`status: "Completed"`) |
| DELETE | `/api/sprints/:id` | SM | delete; stories return to backlog |
| POST | `/api/sprints/:id/tasks` | SM | `{ taskId }` move backlog story into sprint (capacity checked) |
| DELETE | `/api/sprints/:id/tasks/:taskId` | SM | return story to backlog |
| GET  | `/api/activity?limit=20` | any | recent activity log (FR-24) |
| GET  | `/api/backlog` | any | backlog sorted High → Medium → Low |
| POST | `/api/backlog` | PO | add story |
| PUT  | `/api/backlog/:id` | PO | edit story |
| DELETE | `/api/backlog/:id` | PO | delete story |

### Business rules

* **Workflow (FR-18):** `To-Do → In Progress → Review → Done`, one step at a time.
  Skipping (To-Do → Done) or moving backwards returns
  `400 { "message": "Invalid workflow transition" }`.
* **Velocity cap (FR-14):** adding a story that pushes a sprint over its
  `velocityCapacity` returns `400 "Sprint Capacity Exceeded: …"`.
* **Account lock (FR-06):** 3 consecutive wrong passwords lock the account for
  15 minutes (`423 Locked`).
* **Activity log (FR-24/25):** logins, task moves, sprint and backlog changes are
  stored in the `activitylogs` collection with user ID, action and timestamp.

### Socket.IO events (server → client)

`taskUpdated`, `taskCreated`, `taskDeleted`, `sprintChanged`, `backlogChanged`, `activity` (live feed), `presence` (who is online).
Socket connections require a valid JWT (cookie or `auth.token`).

---

## 5. Postman walkthrough

1. `POST http://localhost:5000/api/auth/register`
   `{ "name": "Test Dev", "email": "test@x.com", "password": "secret123", "role": "DEV" }`
2. `POST http://localhost:5000/api/auth/login` `{ "email": "test@x.com", "password": "secret123" }`
   – Postman stores the cookie automatically (or copy `token` into a Bearer header).
3. `GET http://localhost:5000/api/tasks`
4. `PUT http://localhost:5000/api/tasks/<id>` `{ "status": "Done" }` on a To-Do task → **400 Invalid workflow transition**

---

## 6. Requirement traceability (summary)

| Requirement | Where |
|-------------|-------|
| FR-01..03, FR-05 | `controllers/authController.js` |
| FR-04, NFR-07 | `middleware/authMiddleware.js` (`protect`, `authorize`) |
| FR-06 | `authController.login` + `User.failedLoginAttempts / lockUntil` |
| FR-07..11 | `controllers/backlogController.js`, `components/Backlog.jsx` |
| FR-12..15 | `controllers/sprintController.js`, `utils/sprintCapacity.js`, `components/SprintManager.jsx` |
| FR-16..19 | `controllers/taskController.js`, `utils/workflow.js`, `components/KanbanBoard.jsx` |
| FR-20, NFR-01 | `services/socketService.js`, `frontend/src/services/socket.js`, `tests/socket.test.js` |
| FR-24, FR-25 | `models/ActivityLog.js`, `utils/activityLogger.js` |
| NFR-05, NFR-06 | bcrypt 10 rounds; HttpOnly cookie (`secure` in production) |
| NFR-10, NFR-11 | `config/db.js` retry; Socket.IO auto-reconnect; `api.move` retries 3× on network errors |
| NFR-13, NFR-15 | card flash / shake animations; Tab + Enter / → moves cards |
| NFR-16 | Jest coverage report |
| NFR-22 | central error handler hides internals; no passwords/URIs in logs |

### Not yet implemented
* Comments on tasks (FR-21..23) – model/routes not built yet.
* TLS 1.3 (NFR-08) is a deployment concern (HTTPS on the hosting platform);
  locally the app runs on plain HTTP.
