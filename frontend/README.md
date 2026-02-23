# Frontend Boilerplate

This frontend is based on the Figma Make output now stored in `../Figma/`.

## API Integration

A lightweight API client is included in `src/api/client.ts` and used by `src/app/App.tsx` to:

- bootstrap dashboard data from backend
- create waitlist entries
- remove waitlist entries

If backend is unavailable, the app falls back to local demo/localStorage behavior.
