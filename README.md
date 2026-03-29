# Waitlist Management Boilerplates

This repository now includes separate frontend and backend app folders plus multiple Figma export snapshots:

- `Figma/` - earlier untouched Figma-exported source snapshot
- `Figma phase 4/` - phase 4 Figma export referenced for the active buildout
- `frontend/` - runnable web app scaffold now wired end-to-end to the backend
- `backend/` - API implementation for auth, events, waitlist, and staff operations

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set optional env vars in `frontend/.env`:

- `VITE_API_BASE_URL` (default: `http://localhost:8000/v1`)
- `VITE_EVENT_ID` (default: `demo-event`)

## Backend

```bash
cd backend
npm install
npm run dev
```

Set optional env vars in `backend/.env`:

- `PORT` (default: `8000`)
- `CORS_ALLOWED_ORIGINS` (comma-separated allowlist; defaults to localhost Vite origins)
- `ACCESS_TOKEN_TTL_MS`
- `REFRESH_TOKEN_TTL_MS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

The backend exposes `http://localhost:8000/v1` with routes for:

- Auth (`/auth/login`, `/auth/signup/*`, `/auth/me`, `/auth/refresh`, `/auth/logout`)
- Events (`/events`)
- Waitlist (`/events/:eventId/waitlist`)
- Staff (`/events/:eventId/staff/dashboard`, `/staff/promote`, `/staff/seat`, `/staff/clear-table`)
- Sync (`/sync`)

## Demo Accounts

- Staff: `admin@demo.com` / `password123`
- Guest: `guest@demo.com` / `password123`

## Security Notes

The current prototype now includes:

- hashed passwords
- expiring access and refresh tokens
- strict CORS allowlists
- RBAC and IDOR protections on event/waitlist access
- request rate limiting
- defensive security headers

`#SPEC GAP`: the spec explicitly calls for bcrypt/JWT, but this repo currently uses Node built-in `scrypt` plus opaque in-memory tokens because package installation is blocked in this execution environment.

## Production Readiness

For an always-current list of production blockers, spec divergences, and required release work, see `PRODUCTION_CHECKLIST.md`.
For the continuously maintained phase-by-phase progress view, see `SPEC_PROGRESS_ASSESSMENT.md`.
