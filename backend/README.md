# Backend Boilerplate

Express + TypeScript API scaffold implementing core endpoints from the Waitlist API contract.

## Supabase integration quick-start

If you are adding `backend/supabaseTest.py`, follow the concrete sequence in `../SUPABASE_OPTION_A_SETUP.md` (section "Exact \"then what\" sequence").

- Keep `SUPABASE_SERVICE_ROLE_KEY` on backend only.
- Use `supabaseTest.py` for seed/connectivity checks, not as your runtime app API.
- Migrate backend routes (`auth` -> `events` -> `waitlist/staff`) to Supabase incrementally.

`#SPEC GAP`: Supabase schema and migration SQL files are not yet codified in this repository, so table naming may differ from your local project.

## Endpoints

- `POST /v1/auth/login`
- `GET /v1/events`
- `GET /v1/events/:eventId`
- `POST /v1/events`
- `GET /v1/events/:eventId/waitlist`
- `POST /v1/events/:eventId/waitlist`
- `GET /v1/events/:eventId/waitlist/:entryId`
- `DELETE /v1/events/:eventId/waitlist/:entryId`
- `GET /v1/events/:eventId/staff/dashboard`
- `POST /v1/events/:eventId/staff/promote`
- `POST /v1/events/:eventId/staff/seat`
- `POST /v1/sync`
