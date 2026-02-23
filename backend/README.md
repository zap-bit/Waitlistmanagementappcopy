# Backend Boilerplate

Express + TypeScript API scaffold implementing core endpoints from the Waitlist API contract.

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
