# AGENT-READY PRODUCT SPECIFICATION

# Waitlist Management App

**Event Queue & Guest Management Platform**

| Field | Value |
|---|---|
| **Version** | 1.0 — Current Build |
| **Stack** | React 18 · Node/Express · Supabase (PostgreSQL) |
| **Auth** | JWT (access + refresh tokens), two account types |
| **AI Backend** | Python/FastAPI (backend-ai) |
| **Analytics** | PostHog |
| **Last Updated** | May 2026 |

> Read this entire specification before writing a single line of code.
> This document is the single source of truth for all AI coding agents. When the spec and your judgment conflict, implement the spec and add a `// SPEC QUESTION:` comment.

---

## Table of Contents

1. Product Overview
2. Tech Stack
3. Project File Structure
4. Data Models
5. Feature Set — Auth & Accounts
6. Feature Set — Events
7. Feature Set — Waitlist & Queue
8. Feature Set — Staff Operations
9. Feature Set — AI Backend
10. API Reference
11. UI/UX Guidelines
12. Error Handling Standards
13. Non-Functional Requirements
14. Environment Variables
15. Glossary
16. Agent Instructions & Constraints

---

## 1. Product Overview

The Waitlist Management App allows businesses to create and manage events with a live queue. Attendees join a waitlist for an event and see their position and estimated wait time in real time. Businesses (staff) manage the queue, seat guests, and track table availability.

The app supports two distinct event types:

- **Capacity-based events**: A venue with a general capacity (e.g. a food truck, exhibit, or lecture). Guests queue up. Staff can run single or multiple queues.
- **Table-based events**: A restaurant-style setup with named tables of varying sizes. Staff assign specific tables to parties.

### 1.1 User Roles

| Role | Account Type | Capabilities |
|---|---|---|
| **Attendee** (USER) | `USER` account | Browse events, join waitlist, view queue position, edit/cancel their entry |
| **Staff** (BUSINESS) | `BUSINESS` account | Create/manage events, view and manage full waitlist, seat/promote guests, clear tables |

### 1.2 Core Value Proposition

- **Businesses**: Replace paper/verbal waitlists with a live, digital queue. See real-time occupancy and manage flow.
- **Attendees**: Join a waitlist remotely, see position and estimated wait, get notified when it's their turn.

| Platform | Web app (React SPA). Mobile-responsive. |
|---|---|
| Auth | JWT — email/password only. Two separate signup flows (user vs. business). |
| Persistence | Supabase (PostgreSQL) for all server-side data. localStorage used for offline cache. |
| Offline | Optimistic local updates queued and synced on reconnect (offline queue pattern). |

---

## 2. Tech Stack

All technology decisions below reflect what is **already in use** in this codebase. Do not substitute libraries without adding a `// ARCH DECISION:` comment.

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript | Vite for bundling. No class components. |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI) | `src/styles/` for global styles. shadcn components in `src/app/components/ui/`. |
| State | React `useState` + `localStorage` | No Zustand or Redux. State lives in `App.tsx`, passed via props. |
| Backend | Node.js + Express (TypeScript) | `backend/src/`. REST API at `/v1/`. |
| Database | Supabase (PostgreSQL) | Accessed via `@supabase/supabase-js`. Schema in `backend/schema.sql`. |
| Auth | JWT (access + refresh tokens) | Tokens stored in `localStorage`. Access token sent as `Authorization: Bearer`. |
| HTTP Client | `fetch` (native) | No axios. Calls centralized in `App.tsx` and `utils/`. |
| AI Backend | Python / FastAPI | `backend-ai/` directory. Separate service. |
| Analytics | PostHog | `@posthog/react`. Initialized in `main.tsx`. |
| QR Code | `react-qr-code` + `html5-qrcode` | QR generation and scanning for check-in. |
| Drag & Drop | `react-dnd` + `react-dnd-html5-backend` | Used in table grid for drag-to-seat. |
| Charts | Recharts | For any capacity/analytics visualizations. |
| Animations | `motion` (Framer Motion) | Splash screen and transitions. |
| Icons | `lucide-react` + `@mui/icons-material` | Use `lucide-react` first; MUI icons are secondary. |

---

## 3. Project File Structure

```
Waitlistmanagementappcopy/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx               # Root component — global state, auth flow, role routing
│   │   │   ├── components/
│   │   │   │   ├── AttendeeView.tsx   # Attendee dashboard (browse events, manage queue entry)
│   │   │   │   ├── StaffDashboard.tsx # Staff dashboard (waitlist, tables, occupancy)
│   │   │   │   ├── Welcome.tsx        # Landing/welcome screen (unauthenticated)
│   │   │   │   ├── Login.tsx          # Login form
│   │   │   │   ├── Signup.tsx         # Signup form (user + business flows)
│   │   │   │   ├── SplashScreen.tsx   # Animated splash after login
│   │   │   │   ├── CreateEventModal.tsx  # Staff: create new event
│   │   │   │   ├── CircularProgress.tsx  # Capacity ring visualization
│   │   │   │   ├── TableGrid.tsx         # Staff: table layout with drag-to-seat
│   │   │   │   ├── StatusBar.tsx         # Live occupancy status bar
│   │   │   │   ├── QRCodeModal.tsx       # Show QR code for event check-in
│   │   │   │   ├── QRScanner.tsx         # Scan QR code (attendee or staff)
│   │   │   │   ├── Profile.tsx           # User profile view
│   │   │   │   ├── SimpleCapacityTracker.tsx  # Lightweight count-in/count-out
│   │   │   │   ├── figma/
│   │   │   │   │   └── ImageWithFallback.tsx
│   │   │   │   └── ui/               # shadcn/ui primitives (do not modify)
│   │   │   └── utils/
│   │   │       ├── auth.ts           # Login/signup/logout helpers, token storage
│   │   │       ├── events.ts         # Event data helpers, localStorage cache
│   │   │       ├── waitTime.ts       # Wait time calculation (heuristic + backend)
│   │   │       └── offlineQueue.ts   # Queue offline ops; flush on reconnect
│   │   ├── api/
│   │   │   ├── client.ts             # (placeholder — fetch calls live in App.tsx currently)
│   │   │   └── types.ts              # Shared API types
│   │   ├── main.tsx                  # Entry point, PostHog initialization
│   │   └── styles/                   # Global CSS, Tailwind, theme tokens
│   ├── public/                       # Static assets (images, video, favicon)
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.ts                 # Express app setup, middleware, route mounting
│   │   ├── config.ts                 # Env var config (assertConfig validates on startup)
│   │   ├── routes/
│   │   │   ├── auth.ts               # /v1/auth — login, signup, refresh, me, history
│   │   │   ├── events.ts             # /v1/events — CRUD + queues + tables
│   │   │   ├── waitlist.ts           # /v1/events/:eventId/waitlist — join, leave, update, estimate
│   │   │   ├── staff.ts              # /v1/events/:eventId/staff — dashboard, promote, seat, clear
│   │   │   └── sync.ts               # /v1/sync — batch offline sync
│   │   ├── middleware/
│   │   │   ├── auth.ts               # requireAuth, requireRole, requireStaffEventAccess
│   │   │   ├── error.ts              # ApiError class, global error handler, notFound
│   │   │   └── rateLimit.ts          # In-memory rate limiter
│   │   ├── lib/
│   │   │   ├── supabase.ts           # Supabase client (service role key)
│   │   │   ├── security.ts           # hashPassword, verifyPassword (bcrypt)
│   │   │   └── session.ts            # issueSession, rotateRefreshToken (JWT)
│   │   ├── services/
│   │   │   └── waitlistLogic.ts      # calculateHeuristicWait — wait time estimation
│   │   ├── data/
│   │   │   └── store.ts              # (legacy in-memory store — no longer used in prod)
│   │   └── types/
│   │       └── contracts.ts          # Shared TypeScript interfaces (AccountModel, EventModel, etc.)
│   ├── schema.sql                    # Current Supabase table definitions
│   ├── migrations/schema.sql         # Migration history
│   └── package.json
│
├── backend-ai/
│   └── app/
│       ├── main.py                   # FastAPI entry point
│       ├── models.py                 # Pydantic request/response models
│       ├── services.py               # AI logic (wait time prediction, etc.)
│       ├── store.py                  # In-memory or DB-backed state
│       ├── auth.py                   # AI service auth
│       ├── config.py                 # Environment config
│       └── errors.py                 # Error handling
│
└── Documentation/
    ├── API_DOCUMENTATION.md
    ├── SECURITY.md
    └── PROJECT_SPEC.md               # This file
```

---

## 4. Data Models

All models are defined in Supabase. The canonical source of truth is `backend/schema.sql`.

### 4.1 ACCOUNT

```sql
CREATE TABLE ACCOUNT (
    UUID         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT    NOT NULL,
    account_type TEXT    NOT NULL CHECK (account_type IN ('USER', 'BUSINESS')),
    email        TEXT    UNIQUE NOT NULL,
    password     TEXT    NOT NULL,               -- bcrypt hash
    business_name TEXT,                          -- required when account_type = 'BUSINESS'
    phone        TEXT
);
```

- `account_type = 'USER'` → attendee. `business_name` must be NULL.
- `account_type = 'BUSINESS'` → staff/business owner. `business_name` must be set.
- The account UUID doubles as the `businessId` for BUSINESS accounts.

### 4.2 EVENTS

```sql
CREATE TABLE EVENTS (
    UUID                 UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid         UUID     NOT NULL REFERENCES ACCOUNT(UUID),
    name                 TEXT     NOT NULL,
    event_type           TEXT     NOT NULL CHECK (event_type IN ('TABLE', 'CAPACITY')),
    archived             BOOLEAN  NOT NULL DEFAULT FALSE,
    location             TEXT,
    -- CAPACITY-only fields:
    cap_type             TEXT     CHECK (cap_type IN ('SINGLE', 'MULTI', 'ATTENDANCE')),
    queue_capacity       INTEGER,
    est_wait             INTEGER,               -- minutes per party slot
    -- TABLE-only fields:
    num_tables           INTEGER,
    avg_size             INTEGER,
    reservation_duration INTEGER,
    no_show_policy       INTEGER,
    -- Computed/optional:
    no_show_rate         INTEGER,
    avg_service_time     INTEGER,
    event_code           TEXT,                  -- short code for attendee join
    public               BOOLEAN  DEFAULT TRUE
);
```

**Event types:**
- `CAPACITY`: Venue with a head-count limit. `cap_type` controls queue mode:
  - `SINGLE` — one queue for the whole event
  - `MULTI` — multiple named sub-queues (stored in `event_queues` table)
  - `ATTENDANCE` — count-in/count-out (no individual queue entries)
- `TABLE`: Restaurant style. Guests are assigned to specific tables.

### 4.3 event_queues (CAPACITY / MULTI events)

| Column | Type | Notes |
|---|---|---|
| uuid | UUID | PK |
| event_uuid | UUID | FK → EVENTS |
| name | TEXT | Queue display name |
| capacity | INTEGER | Max people in this queue |
| current_count | INTEGER | Live count |
| manual_offset | INTEGER | Staff-adjusted offset |
| event_datetime | TIMESTAMPTZ | Optional scheduled time for this queue |

### 4.4 PARTY (Waitlist Entry)

```sql
CREATE TABLE PARTY (
    UUID            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid    UUID    NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid      UUID    NOT NULL REFERENCES EVENTS(UUID),
    name            TEXT    NOT NULL,           -- guest name
    party_size      INTEGER NOT NULL,
    special_req     TEXT,                       -- encoded as "name | special requests"
    type            TEXT    DEFAULT 'waitlist', -- 'waitlist' | 'reservation'
    status          TEXT    DEFAULT 'QUEUED',   -- 'QUEUED' | 'SEATED' | 'NO_SHOW'
    position        INTEGER,                    -- 1-based queue position
    estimated_wait  INTEGER DEFAULT 15,         -- minutes
    joined_at       TIMESTAMPTZ DEFAULT now(),
    reservation_time TIMESTAMPTZ               -- only set for type='reservation'
);
```

### 4.5 EVENT_TABLE

```sql
CREATE TABLE EVENT_TABLE (
    UUID            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid    UUID     REFERENCES ACCOUNT(UUID),  -- who is seated
    event_uuid      UUID     NOT NULL REFERENCES EVENTS(UUID),
    table_capacity  INTEGER  NOT NULL,
    name            TEXT     NOT NULL,
    table_number    INTEGER,
    occupied        BOOLEAN  DEFAULT FALSE,
    guest_name      TEXT,
    party_size      INTEGER,
    seated_at       TIMESTAMPTZ
);
```

### 4.6 CAP_WAITLIST (Historical record)

```sql
CREATE TABLE CAP_WAITLIST (
    UUID            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid    UUID    NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid      UUID    NOT NULL REFERENCES EVENTS(UUID),
    dropped_out     BOOLEAN NOT NULL,
    no_show         BOOLEAN NOT NULL,
    exit_reason     TEXT    CHECK (exit_reason IN ('SERVED', 'CANCEL', 'NO_SHOW')),
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

A record is inserted into `CAP_WAITLIST` when a party is served (seated), cancels, or is marked no-show.

### 4.7 NOTIFICATIONS

```sql
CREATE TABLE NOTIFICATIONS (
    UUID            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid    UUID    NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid      UUID    NOT NULL REFERENCES EVENTS(UUID),
    sent_time       TIMESTAMPTZ NOT NULL
);
```

Inserted when staff promotes/notifies a guest.

---

## 5. Feature Set — Auth & Accounts

### F-101: User Authentication

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| R-101 | Attendee can sign up | `POST /v1/auth/signup/user` with `{ email, password, name }`. Password min 12 chars. Returns `{ token, refreshToken, expiresIn, user }`. |
| R-102 | Business can sign up | `POST /v1/auth/signup/business` with `{ email, password, ownerName, businessName }`. Creates `BUSINESS` account. Returns same shape. |
| R-103 | User can log in | `POST /v1/auth/login` with `{ email, password }`. Returns tokens + user. Generic error on failure: 'Invalid email or password'. Never reveal whether the email exists. |
| R-104 | Token refresh | `POST /v1/auth/refresh` with `{ refreshToken }` in body. Returns new `{ token, refreshToken, expiresIn, user }`. |
| R-105 | Get current user | `GET /v1/auth/me` (protected). Returns `{ user: { id, email, name, role, businessId? } }`. |
| R-106 | Logout | `POST /v1/auth/logout` (protected). Stateless — client discards tokens. |
| R-107 | Authenticated routes are protected | All non-auth routes require `Authorization: Bearer <token>`. Missing/expired token returns 401. |
| R-108 | Attendee can view their waitlist entries | `GET /v1/auth/me/waitlist`. Returns all active PARTY rows for the user, with computed `position`. |
| R-109 | Attendee can view their history | `GET /v1/auth/me/history`. Returns served CAP_WAITLIST records with event names. |
| R-110 | Attendee can view their seated table | `GET /v1/auth/me/seated`. Returns currently occupied EVENT_TABLE rows for the user. |

**Account type → role mapping:**
- `account_type = 'USER'` → `role: 'user'` (attendee)
- `account_type = 'BUSINESS'` → `role: 'staff'`, `businessId = account.uuid`

---

## 6. Feature Set — Events

### F-201: Event CRUD (Staff only for write operations)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| R-201 | List events | `GET /v1/events`. Staff: returns all events for their business. Attendees: returns all non-archived events. Includes `event_queues` array on each event. |
| R-202 | Get single event | `GET /v1/events/:eventId`. Returns the event. Staff may only access events they own (403 otherwise). |
| R-203 | Create event (staff) | `POST /v1/events`. Requires `event_type` ('TABLE' or 'CAPACITY'). Type-specific validation enforced by DB constraint. Returns `201` with created event. |
| R-204 | Update event (staff) | `PATCH /v1/events/:eventId`. Partial update. Staff can only modify their own events (403 otherwise). |
| R-205 | Archive event (staff) | `DELETE /v1/events/:eventId` (no `?permanent`). Sets `archived = true`. Soft delete. |
| R-206 | Permanently delete event (staff) | `DELETE /v1/events/:eventId?permanent=true`. Hard delete. Only for staff who own the event. |
| R-207 | Manage queues for MULTI events | `PUT /v1/events/:eventId/queues`. Body: `{ queues: [{ name, capacity, currentCount, manualOffset, eventDateTime? }] }`. Replaces all queues for the event atomically. |
| R-208 | Manage table configuration | `PUT /v1/events/:eventId/tables/:tableId`. Upsert a table record for the event. |

**Event type validation rules (enforced in DB):**
- `CAPACITY` events must have: `cap_type`, `queue_capacity`, `est_wait`. TABLE-specific fields must be NULL.
- `TABLE` events must have: `num_tables`, `avg_size`, `reservation_duration`, `no_show_policy`. CAPACITY-specific fields must be NULL.

---

## 7. Feature Set — Waitlist & Queue

### F-301: Waitlist Management

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| R-301 | Join a waitlist | `POST /v1/events/:eventId/waitlist`. Body: `{ name, partySize, specialRequests?, type?, reservationTime? }`. `type` defaults to `'waitlist'`. Returns `201` with the PARTY row. Position is count of existing entries + 1. |
| R-302 | View waitlist | `GET /v1/events/:eventId/waitlist`. Staff: all entries for the event. Attendee: only their own entries. |
| R-303 | View single entry | `GET /v1/events/:eventId/waitlist/:entryId`. Staff or owner only. |
| R-304 | Update entry | `PATCH /v1/events/:eventId/waitlist/:entryId`. Body: `{ name?, partySize?, specialRequests?, reservationTime? }`. Staff or owner only. |
| R-305 | Cancel/leave waitlist | `DELETE /v1/events/:eventId/waitlist/:entryId`. Staff or owner only. Hard delete from PARTY. |
| R-306 | Get wait time estimate | `GET /v1/events/:eventId/waitlist/estimate`. Returns `{ estimatedWait: number, queueSize: number }`. Uses heuristic calculation (see §7.1). |

### 7.1 Wait Time Estimation Algorithm

The heuristic wait time is computed in `backend/src/services/waitlistLogic.ts`:

1. Fetch all `QUEUED` parties for the event.
2. Determine `noShowRate` from historical `CAP_WAITLIST` data (if < 5 records exist, fall back to `event.no_show_rate ?? 0.15`).
3. `estimatedWait = ceil(queueSize × (1 - noShowRate) × event.est_wait)`

The frontend (`frontend/src/app/utils/waitTime.ts`) then converts this to a per-user estimate:
- `perPersonWait = estimatedWait / queueSize`
- `userWait = ceil(perPersonWait × (position - 1))`

### 7.2 Offline Queue Pattern

When an attendee action (add, remove, update) is performed offline, the frontend:
1. Applies the change optimistically to local state.
2. Queues the operation via `offlineQueue.ts` (`queueOp`).
3. On reconnect (`window.addEventListener('online')`), calls `flushPendingOps` which replays ops against the API in order.
4. If an ADD_WAITLIST was queued without a remote ID, it resolves the local ID → remote UUID via the callback.

Supported operation types: `ADD_WAITLIST`, `REMOVE_WAITLIST`, `UPDATE_WAITLIST`, `ADD_EVENT`.

---

## 8. Feature Set — Staff Operations

### F-401: Staff Dashboard & Actions

All routes under `/v1/events/:eventId/staff` require: authenticated + `role = 'staff'` + event ownership.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| R-401 | Staff dashboard | `GET /v1/events/:eventId/staff/dashboard`. Returns `{ occupancy: { occupiedTables, totalTables, guestsSeated }, waitlist: [], tables: [] }`. |
| R-402 | Promote / notify guest | `POST /v1/events/:eventId/staff/promote`. Body: `{ entryId? }`. If no `entryId`, promotes the first in queue. Inserts a NOTIFICATIONS record. Returns the promoted entry. |
| R-403 | Seat a guest | `POST /v1/events/:eventId/staff/seat`. Body: `{ entryId, tableId? }`. Deletes the PARTY row, inserts a `CAP_WAITLIST` record with `exit_reason = 'SERVED'`. If `tableId` is provided, marks `EVENT_TABLE` as occupied with guest info. |
| R-404 | Clear a table | `POST /v1/events/:eventId/staff/clear-table`. Body: `{ tableId }`. Resets `occupied`, `account_uuid`, `guest_name`, `party_size`, `seated_at` on the table row. |
| R-405 | Sync offline staff ops | `POST /v1/sync`. Replays a batch of queued operations from the client when coming back online. |

### 8.1 QR Code Check-in

- Each event has an `event_code` field (short alphanumeric code) or a full UUID-based QR.
- The `QRCodeModal` component generates a QR from the event UUID.
- The `QRScanner` component reads a QR code and triggers an attendee join or staff check-in flow.

---

## 9. Feature Set — AI Backend

The Python FastAPI service in `backend-ai/` provides:

| Endpoint | Description |
|---|---|
| `POST /predict` | Predict wait time from queue data (ML model or heuristic) |
| Other routes per `main.py` | See `backend-ai/app/main.py` for full route list |

**Security:** Any AI API keys or ML model credentials must be stored in `backend-ai/.env` only. Never reference them in frontend code or commit them to version control.

---

## 10. API Reference

Base URL: `/v1`. All responses are JSON. All protected routes require `Authorization: Bearer <accessToken>`. Timestamps are ISO 8601 UTC.

### 10.1 Auth Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | None | Login. Returns `{ token, refreshToken, expiresIn, user }`. 401 on failure. |
| POST | `/auth/signup/user` | None | Attendee signup. 409 if email exists. |
| POST | `/auth/signup/business` | None | Business signup. 409 if email exists. |
| POST | `/auth/refresh` | None | Body: `{ refreshToken }`. Returns new token pair. |
| POST | `/auth/logout` | Required | Stateless — client discards tokens. |
| GET | `/auth/me` | Required | Returns current user. |
| GET | `/auth/me/waitlist` | Required | Returns user's active waitlist entries with position. |
| GET | `/auth/me/history` | Required | Returns last 50 served records with event names. |
| GET | `/auth/me/seated` | Required | Returns currently occupied tables for the user. |

### 10.2 Events Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/events` | Required | List events (filtered by role). |
| GET | `/events/:eventId` | Required | Single event. |
| POST | `/events` | Staff | Create event. |
| PATCH | `/events/:eventId` | Staff (owner) | Partial update. |
| DELETE | `/events/:eventId` | Staff (owner) | Archive (soft). `?permanent=true` for hard delete. |
| PUT | `/events/:eventId/queues` | Staff (owner) | Replace all queues for a MULTI event. |
| PUT | `/events/:eventId/tables/:tableId` | Staff (owner) | Upsert a table. |

### 10.3 Waitlist Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/events/:eventId/waitlist` | Required | List entries (all for staff, own for attendee). |
| POST | `/events/:eventId/waitlist` | Required | Join waitlist. |
| GET | `/events/:eventId/waitlist/estimate` | Required | Get wait time estimate. |
| GET | `/events/:eventId/waitlist/:entryId` | Required | Get single entry (owner or staff). |
| PATCH | `/events/:eventId/waitlist/:entryId` | Required | Update entry (owner or staff). |
| DELETE | `/events/:eventId/waitlist/:entryId` | Required | Cancel entry (owner or staff). |

### 10.4 Staff Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/events/:eventId/staff/dashboard` | Staff (owner) | Full dashboard snapshot. |
| POST | `/events/:eventId/staff/promote` | Staff (owner) | Notify next guest (or specific `entryId`). |
| POST | `/events/:eventId/staff/seat` | Staff (owner) | Seat a guest, optionally at a table. |
| POST | `/events/:eventId/staff/clear-table` | Staff (owner) | Mark table as unoccupied. |

### 10.5 Sync Route

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/sync` | Required | Replay queued offline operations. |

---

## 11. UI/UX Guidelines

### 11.1 Views & Routing

The app is a single-page application with view state managed in `App.tsx` — not React Router (URL-based routing is not currently in use for the main views). View selection is driven by `authScreen` and `selectedRole` state.

| State | Rendered Component |
|---|---|
| Not logged in, `authScreen = 'welcome'` | `Welcome` |
| Not logged in, `authScreen = 'login'` | `Login` |
| Not logged in, `authScreen = 'signup'` | `Signup` |
| After login (loading) | `SplashScreen` |
| `selectedRole = 'staff'` | `StaffDashboard` |
| `selectedRole = 'attendee'` | `AttendeeView` |

### 11.2 Toast Notifications

All transient feedback uses `sonner` (the `Toaster` + `toast` API). Patterns:
- `toast.success(...)` — successful actions (login, join waitlist, etc.)
- `toast.error(...)` — failures
- `toast.warning(..., { id, duration: Infinity })` — offline state (dismissed on reconnect)
- `toast.loading(..., { id })` + `toast.dismiss(id)` — async operations with progress

Never use `alert()` or `window.confirm()`.

### 11.3 Component Organization

- **UI primitives**: `src/app/components/ui/` — shadcn/ui Radix-based components. Do not modify these directly.
- **Feature components**: `src/app/components/` — app-specific screens and widgets.
- **Utilities**: `src/app/utils/` — pure functions, no JSX.

### 11.4 PostHog Events

Track meaningful user actions using `posthog?.capture(eventName, properties)`. Existing events:
- `user_logged_in`, `user_logged_out`, `user_signed_up`
- `waitlist_joined`, `waitlist_left`

When adding new features, add a corresponding PostHog capture call.

---

## 12. Error Handling Standards

### 12.1 API Error Response Format

All API errors return:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Thrown via `new ApiError(httpStatus, code, message, details?)` (see `backend/src/middleware/error.ts`).

### 12.2 Standard Error Codes

| Code | HTTP Status | When |
|---|---|---|
| `INVALID_INPUT` | 400 | Validation failure, bad request body |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Missing or expired access token |
| `FORBIDDEN` | 403 | Token valid but user doesn't own this resource |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist |
| `EMAIL_EXISTS` | 409 | Duplicate email on signup |
| `CONFLICT` | 409 | Other conflict (duplicate resource, etc.) |
| `SERVER_ERROR` | 500 | Unexpected internal error |

### 12.3 Frontend Error Handling

- Network errors: show `toast.error('Something went wrong. Please try again.')`.
- 401 on protected route: clear auth state, redirect to login screen.
- 403: show a contextual error message (not a page redirect).
- 409 (email exists): show 'Email already exists' inline.
- Never expose raw error objects or stack traces in the UI.

---

## 13. Non-Functional Requirements

### 13.1 Security

- Passwords hashed with bcrypt (see `backend/src/lib/security.ts`). Never stored in plaintext.
- Access token TTL: short-lived (see `session.ts`). Refresh token: longer-lived, rotated on use.
- All write operations verify resource ownership — staff can only modify their own events and parties.
- Rate limiting applied globally via `backend/src/middleware/rateLimit.ts`.
- CORS restricted to `config.corsAllowedOrigins` in production.
- Security headers set on all responses (see `server.ts`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.
- Tokens stored in `localStorage` (not httpOnly cookies) — accepted trade-off for this project.
- AI API keys stored only in `backend-ai/.env`. Never referenced in frontend.

### 13.2 Performance

- Attendee waitlist position refreshed by polling every 15 seconds (`setInterval` in `App.tsx`).
- Events cached in `localStorage` and hydrated on load (`utils/events.ts`).
- Offline operations buffered and replayed in order on reconnect.
- DB queries always scoped to `event_uuid` or `account_uuid` — never full table scans.

### 13.3 Accessibility

- All interactive elements should be keyboard navigable.
- Sonner toasts are announced for screen readers.
- Use semantic HTML elements (buttons, labels, inputs with `id`/`htmlFor`).

### 13.4 Code Quality

- TypeScript throughout. No implicit `any` where avoidable.
- No `console.log` in production code paths.
- All env vars accessed through `config.ts` on the backend.
- Frontend env vars accessed via `import.meta.env.VITE_*`.

---

## 14. Environment Variables

### Backend (`backend/.env`)

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
PORT=8000
CORS_ALLOWED_ORIGINS=       # comma-separated list of allowed frontend origins
NODE_ENV=                   # development | production
```

### Frontend (`frontend/.env`)

```bash
VITE_API_BASE_URL=          # e.g. http://localhost:8000/v1
```

### AI Backend (`backend-ai/.env`)

```bash
# AI/ML service credentials — never expose to frontend
SUPABASE_URL=
SUPABASE_KEY=
```

---

## 15. Glossary

| Term | Definition |
|---|---|
| Attendee | A `USER` account holder who joins waitlists. Frontend role: `'attendee'`. |
| Staff | A `BUSINESS` account holder who manages events and queues. Frontend role: `'staff'`. |
| Party | A group joining the waitlist together. Represented by one PARTY row. `party_size` is the group count. |
| Entry | Synonym for a PARTY row (one record in the waitlist). |
| Position | 1-based rank in the queue. Lower = closer to front. |
| Estimated wait | Minutes until the party is expected to be served. Computed from queue size and `est_wait` per slot. |
| CAPACITY event | An event with a general head-count limit. Guests form a queue (single, multi, or attendance). |
| TABLE event | A restaurant-style event. Guests are assigned to specific named tables. |
| QUEUED | Party status: waiting in line. |
| SERVED | Party was successfully seated. Recorded in CAP_WAITLIST with `exit_reason = 'SERVED'`. |
| NO_SHOW | Party did not show up when called. |
| Offline queue | A local buffer of user actions taken while offline, flushed to the API on reconnect. |
| Heuristic wait | The wait time estimate computed server-side using queue size × `est_wait` × `(1 - noShowRate)`. |
| Promote | Notify the next guest that it's their turn (inserts a NOTIFICATIONS record). |
| Seat | Move a guest from the active waitlist to a table (deletes from PARTY, inserts into CAP_WAITLIST). |
| businessId | For BUSINESS accounts, the `businessId` equals the account UUID. Events are owned by `account_uuid = businessId`. |

---

## 16. Agent Instructions & Constraints

Read this section before writing any code.

### 16.1 Architecture Rules

- **Do not add a client-side router** (React Router) without first checking if `App.tsx` state-based view switching is sufficient. If you add routing, document the decision.
- **Do not move fetch calls** out of `App.tsx` without migrating the full pattern to `src/api/` — do it consistently, not piecemeal.
- **Do not add Zustand or Redux** — state is passed via props. If prop drilling becomes extreme, discuss first.
- **Do not add new libraries** without a `// ARCH DECISION:` comment explaining the justification.

### 16.2 Database Rules

- All queries must scope to the authenticated user's `account_uuid` (attendee) or `businessId` (staff). Never query data across users.
- Staff queries must additionally verify `event.account_uuid === req.authUser.businessId` before any mutation.
- Always prefer Supabase's `.maybeSingle()` over `.single()` when a missing row is a valid case.

### 16.3 Security Rules (Non-Negotiable)

- Never hardcode secrets, UUIDs, or API URLs. Use environment variables.
- Never log tokens, passwords, or sensitive user data.
- Never expose stack traces or internal error details in API responses — all production errors return generic messages.
- AI/ML API keys stay in `backend-ai/.env` only.

### 16.4 Decision Rules

- When the spec is ambiguous, implement the simpler interpretation and add `// SPEC QUESTION: [description]`.
- When making an architectural decision not covered here, add `// ARCH DECISION: [explanation]`.
- If you believe this spec has an error, implement as written and add `// SPEC ERROR: [concern]`.

### 16.5 Handling Gaps

If a situation is not covered by this spec, apply these rules in order:

1. Check if a similar pattern is already established elsewhere in the codebase. Follow it.
2. Choose the approach most consistent with the existing architecture.
3. Choose the simpler of two reasonable approaches.
4. Leave a comment explaining your choice.

---

*End of Specification — Waitlist Management App v1.0*
*Generated May 2026 from codebase analysis.*
