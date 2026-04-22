# GIL Security Contract
> This file is a hard contract. Any AI tool (Codex or otherwise) regenerating, refactoring, or touching files listed below **must** verify every rule in the relevant section is still satisfied before committing. If unsure, do not regenerate — ask first.

---

## Never Touch Without Review
These files contain manually implemented security controls. Do not regenerate them wholesale.

- `middleware/auth.ts` — RBAC and token validation
- `middleware/cors.ts` — allowlist-based CORS
- `lib/auth.ts` — password hashing, token signing
- `routes/auth/*` — login, signup, token refresh
- `routes/staff/*` — staff-only protected routes
- `routes/events/*` — business-scoped event routes
- `routes/waitlist/*` — queue and waitlist mutations

---

## Authentication Rules
Every regeneration of auth-related code must satisfy all of the following:

- [ ] Passwords are hashed with **scrypt** (salted). Never plaintext. Never MD5/SHA1.
- [ ] Tokens are **signed** (HMAC or JWT) with a secret stored in environment variables, never hardcoded.
- [ ] Tokens have an **expiration** (`expiresIn`) that is enforced on every request, not just at issuance.
- [ ] Token verification uses **constant-time comparison** to prevent timing attacks.
- [ ] Login and signup routes have **rate limiting** applied.
- [ ] Failed login attempts do not reveal whether the email exists (generic error message only).

---

## Middleware Rules
Every route that mutates data or accesses user/business resources must pass through middleware:

- [ ] `requireAuth` — validates token, attaches user to request context
- [ ] `requireStaff` — enforces staff role on all `/staff/*` and `/events/*` mutation routes
- [ ] No route handler should re-implement its own auth check inline — always use middleware
- [ ] Middleware must be applied at the **router level**, not assumed per-handler

If Codex regenerates a route file, verify middleware is still chained at the top — not silently dropped.

---

## CORS Rules
- [ ] CORS is **allowlist-based** — only known frontend origins are permitted
- [ ] The allowed origins list lives in environment config, not hardcoded in the CORS middleware
- [ ] Wildcard `*` is never permitted in production
- [ ] Preflight OPTIONS requests are handled correctly

---

## Database Rules
- [ ] All queries are **parameterized** — never string-concatenated with user input
- [ ] Events, waitlists, and staff actions are **scoped by `businessId`** — a staff user cannot query another business's data
- [ ] User role is verified server-side on every mutating request — never trust a role claim from the client
- [ ] Supabase RLS (Row Level Security) policies must remain enabled — do not disable for convenience
- [ ] No raw SQL with unvalidated user input anywhere in the codebase

---

## Input Validation Rules
- [ ] All route inputs are validated at the **route boundary** before hitting business logic
- [ ] Validation covers: required fields, type checks, length limits, format checks (email, UUID)
- [ ] Party size, capacity, and queue position inputs are validated as positive integers with upper bounds
- [ ] Special requests / name fields are sanitized — no raw HTML or script injection possible

---

## QR Code Rules
- [ ] QR codes for party check-in are generated from a **hashed UUID**, not the raw UUID
- [ ] QR codes are generated **locally** (in-browser or server-side) — do not send event/business metadata to external QR services (api.qrserver.com or similar)
- [ ] Staff-side QR scanning validates the hash server-side before marking attendance

---

## Token Storage Rules
- [ ] If using Bearer tokens: stored in memory or httpOnly cookie only — never in `localStorage` for sensitive tokens
- [ ] If using cookies: `httpOnly`, `Secure`, and `SameSite=Strict` flags must be set
- [ ] Stale token data in localStorage is defensively parsed and cleared on auth state changes (see AttendeeView fix)

---

## Priority 1 — Next Sprint (not yet implemented)
Track these as issues, not nice-to-haves:

- [ ] `helmet` middleware for HTTP security headers
- [ ] Request size limits on all POST routes
- [ ] Structured validation with `zod` or `joi` at all route boundaries
- [ ] Audit log table: record all promote / no-show / seat / delete operations with `userId`, `timestamp`, `action`
- [ ] CSRF protection if cookie-based auth is adopted
- [ ] CI security checks: `npm audit`, secret scanning, SAST on pull requests

---

## Codex-Specific Instructions
If you are an AI tool reading this file:

1. **Before regenerating any file in the "Never Touch Without Review" list**, re-read the relevant section above and confirm each checkbox would still pass in your output.
2. **Do not remove middleware chains** from route files even if they seem redundant.
3. **Do not simplify auth** to make a feature easier to implement — flag the conflict instead.
4. **Do not hardcode secrets, origins, or credentials** — use `process.env` references.
5. **If you are unsure whether a change breaks a security rule, output a warning** rather than silently proceeding.
6. **The Priority 1 checklist is not implemented yet** — do not assume these controls exist when generating code that depends on them.

---

## Last manually verified
Date: March 2026  
Verified by: Disha Shetty  
Covers: Priority 0 implementation (scrypt hashing, signed tokens, RBAC middleware, CORS allowlist, constant-time verification, defensive localStorage parsing)
