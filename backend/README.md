# Backend (Supabase API)

Express + TypeScript API using Supabase tables aligned to `schema.sql`.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional)
- `CORS_ALLOWED_ORIGINS` (optional)

## Migration plan

1. Apply `migrations/001_schema_alignment.sql` in Supabase SQL Editor.
2. Run `npm run check:migration` to verify required tables are reachable through Supabase.
3. Start API with `npm run dev`.

## Schema mapping used by the API

- Accounts/Auth: `ACCOUNT`
- Events: `EVENTS`
- Waitlist entries: `PARTY`
- Staff tables: `EVENT_TABLE`
- Promotion notifications: `NOTIFICATIONS`
- Served entries audit: `CAP_WAITLIST`

## Endpoints

- `POST /v1/auth/login`
- `POST /v1/auth/signup/user`
- `POST /v1/auth/signup/business`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`
- `GET /v1/auth/me/waitlist`
- `GET /v1/events`
- `GET /v1/events/:eventId`
- `POST /v1/events`
- `PATCH /v1/events/:eventId`
- `DELETE /v1/events/:eventId`
- `GET /v1/events/:eventId/waitlist`
- `POST /v1/events/:eventId/waitlist`
- `GET /v1/events/:eventId/waitlist/:entryId`
- `DELETE /v1/events/:eventId/waitlist/:entryId`
- `GET /v1/events/:eventId/staff/dashboard`
- `POST /v1/events/:eventId/staff/promote`
- `POST /v1/events/:eventId/staff/seat`
- `POST /v1/events/:eventId/staff/clear-table`
- `POST /v1/sync`
