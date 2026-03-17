# Supabase Sync (Option A: Backend owns persistence)

This project is currently structured so the frontend talks to `backend` APIs. Option A keeps that architecture and swaps backend in-memory storage for Supabase.

## 1) Configure environment

Create these files from examples:

- `backend/.env` from `backend/.env.example`
- `frontend/.env` from `frontend/.env.example`

Backend values needed:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Frontend should continue to use:

- `VITE_API_BASE_URL=http://localhost:8000/v1`

## 2) Install and run

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Health check now reports whether Supabase env is configured:

```bash
curl http://localhost:8000/health
```

You should see `supabaseConfigured: true` once backend env vars are set.

## 3) Use your existing `supaBaseTest.py`

Your Python script is good for validating connectivity + seed inserts quickly.

Recommended usage:

1. keep using it to validate basic inserts into your Supabase tables.
2. avoid storing plain passwords long-term in your `account` table.
3. once backend endpoints are connected, move writes from script helpers into API route handlers so the app is the source of truth.

## 4) Table mapping to current API contract

Current backend/frontend expect these app-level concepts:

- users (role: `user`/`staff`)
- businesses
- events (`capacity-based` or `table-based`)
- waitlist entries
- event tables

Your script currently writes to:

- `account`
- `event`
- `eventtable`
- `party`

That can work, but keep naming/typing alignment in route serializers so API responses still match frontend contracts in `frontend/src/api/types.ts`.

## 5) Suggested migration order

1. **Auth route migration**: `backend/src/routes/auth.ts`
   - replace in-memory user lookup with Supabase-backed lookup/verification.
2. **Events route migration**: `backend/src/routes/events.ts`
   - read/write events from Supabase.
3. **Waitlist + staff route migration**: `backend/src/routes/waitlist.ts` and `backend/src/routes/staff.ts`
   - persist queue and seating operations to Supabase tables.
4. **Frontend switch-over**: replace localStorage auth/data helpers with `frontend/src/api/client.ts` calls.

## 6) Security note

If you keep Option A, the browser should never receive the service-role key.
Only backend reads `SUPABASE_SERVICE_ROLE_KEY`.
