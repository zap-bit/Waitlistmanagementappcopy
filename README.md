# Waitlist Management Boilerplates

This repository now includes separate frontend and backend boilerplates:

- `Figma/` - untouched Figma-exported source snapshot
- `frontend/` - runnable frontend app scaffold based on the Figma source
- `backend/` - API boilerplate aligned with the waitlist API contract

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

The backend exposes `http://localhost:8000/v1` with boilerplate routes for:

- Auth (`/auth/login`)
- Events (`/events`)
- Waitlist (`/events/:eventId/waitlist`)
- Staff (`/events/:eventId/staff/dashboard`, `/staff/promote`, `/staff/seat`)
- Sync (`/sync`)

## Supabase (Option A)

If you want Supabase persistence while keeping this frontend/backend architecture, follow:

- `SUPABASE_OPTION_A_SETUP.md`

The backend now includes a Supabase client scaffold at `backend/src/lib/supabase.ts` and exposes `/health` status showing `supabaseConfigured`.

## Production Readiness

For an always-current list of production blockers, spec divergences, and required release work, see `PRODUCTION_CHECKLIST.md`.
For the continuously maintained phase-by-phase progress view, see `SPEC_PROGRESS_ASSESSMENT.md`.
