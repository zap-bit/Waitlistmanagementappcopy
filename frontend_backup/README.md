# Frontend App

This frontend is based on the Figma exports, including the phase 4 design under `../Figma phase 4/`.

## API Integration

The active app uses `src/api/client.ts` and `src/app/App.tsx` to:

- authenticate against the backend with access + refresh tokens
- bootstrap events and dashboard state from the backend
- create/delete events for staff users
- create/remove waitlist entries for attendee users
- promote/seat/clear tables from the staff dashboard

## Security Notes

- The frontend no longer depends on browser-only mock auth/event stores for the active flows.
- Tokens are refreshed automatically on 401 responses where a refresh token is available.
- A small local event cache still exists only to support the existing Figma-derived UI state.
- `#SPEC GAP`: some advanced table-edit controls in the phase 4 UI remain local-only until matching backend APIs are defined.
