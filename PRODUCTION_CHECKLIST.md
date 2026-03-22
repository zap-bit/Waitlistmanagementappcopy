# Production Checklist

> Living document. Update this file whenever implementation diverges from the specification, a production blocker is discovered, or release requirements change.

## Purpose

This checklist tracks the gap between the current repository state and the March 2, 2026 Get-in-Line specification. It is intended to be maintained continuously so contributors, reviewers, and deployers know exactly what still must change before a safe production release.

## How To Maintain This Document

Update this file when any of the following happen:

- A new feature is added that only partially matches the specification.
- An architectural decision intentionally diverges from the specification.
- A production blocker is discovered or resolved.
- A deployment, security, testing, or operational requirement changes.

For each new item:

1. Add the issue under the most relevant section.
2. Mark whether it is a **Blocker**, **Required Before Production**, or **Follow-up**.
3. Record the current behavior, the expected spec behavior, and the action needed.
4. Remove or reclassify the item when it is resolved.

## Current Release Recommendation

- **Do not deploy to production yet.**
- Current repository state is now best treated as a **secured functional prototype** rather than a pure scaffold.

## Production Blockers

| Priority | Area | Current State | Spec Expectation | Action Required |
|---|---|---|---|---|
| Blocker | Architecture | Repo still ships a Vite frontend and an Express backend. | Spec requires Next.js 14 for staff web, React Native (Expo) for attendee mobile, Node.js + Express for real-time logic, and FastAPI for AI services. | Split or migrate the codebase to the required production architecture and document any approved deviations. |
| Blocker | AI Service | No FastAPI AI application is present in the active backend implementation. | Spec requires a Python FastAPI layer for LSTM forecasts and Monte Carlo predictions. | Implement the `app/` Python service layer and connect it to prediction workflows. |
| Blocker | Offline-first | No RxDB + SQLite local-first client implementation is present. | Spec requires offline operation with delta-sync for dead-zone resilience. | Implement local-first storage, sync queueing, and conflict resolution behavior. |
| Blocker | Persistence | Core application data is still stored in an in-memory store. | Spec requires Supabase as the primary relational store and Redis for high-speed queue updates. | Migrate event, account, party, notifications, session, and table operations to persistent infrastructure. |
| Blocker | Security | Core controls improved materially: hashed passwords, expiring access/refresh tokens, strict CORS allowlist, role checks, IDOR checks, and rate limiting now exist. Remaining gaps include persistent session storage, production secret management, formal audit logging, and spec-mandated bcrypt/JWT implementation. | Spec lists these as non-negotiable production requirements. | Replace in-memory sessions with durable/session-store-backed auth, finish production secret handling, add audit logs, and close the `#SPEC GAP` items. |
| Blocker | Testing | Build verification now passes for frontend and backend, and core API flows were manually verified. Coverage automation is still missing. | Spec requires minimum test coverage thresholds before phase gates can pass. | Add unit/integration tests, coverage reporting, and CI enforcement. |
| Blocker | Deployment Readiness | No staging/production deployment pipeline or operational runbook is documented in the active app directories. | Spec requires distinct development, staging, and production environments. | Add deployment documentation, environment strategy, and release runbooks. |

## Required Before Production

| Priority | Area | Current State | Spec Expectation | Action Required |
|---|---|---|---|---|
| Required Before Production | Queue Lifecycle | Queue operations now support authenticated join, self-service leave, staff dashboard review, promote, seat, and clear-table flows. Notification history, TTL automation, and no-show persistence remain shallow. | Status transitions and notification logging should support robust queue automation. | Implement complete state transitions, TTL handling, no-show flows, and notifications persistence. |
| Required Before Production | API Contracts | Auth, events, waitlist, and staff routes are now integrated end-to-end for the active web UI. Some table-management and offline-sync behaviors remain intentionally out of contract. | API contract should match the technical specification, including event types and offline sync semantics. | Audit all routes against the spec and align payload validation, response formats, and missing contract areas. |
| Required Before Production | Config Validation | Backend now validates core runtime config and fails on an empty CORS allowlist. | Spec requires configuration validation at backend startup. | Expand validation to all future secrets/URLs/keys and add explicit environment schema coverage. |
| Required Before Production | Redis | No active Redis-backed FIFO/buffer implementation was found. | Spec requires Redis for sub-200ms queue updates. | Introduce Redis-backed queue primitives and document fallback behavior. |
| Required Before Production | Mobile App | No React Native / Expo attendee application is present in the active implementation. | Spec requires a mobile attendee experience separate from the staff web app. | Build or extract the attendee mobile app into the required stack. |
| Required Before Production | Accessibility | No completed WCAG 2.1 AA audit artifacts were found. | Spec requires keyboard accessibility, focus states, labels, and contrast compliance. | Perform an accessibility audit and fix issues before release. |
| Required Before Production | Observability | Security headers and health checks exist, but structured logs, metrics, and alerting are still absent. | A high-availability queue platform needs production visibility. | Add structured logs, metrics, audit trails, and production alerting. |

## Known Divergences From Spec

| Area | Current Implementation | Spec Requirement | Notes |
|---|---|---|---|
| Frontend framework | Vite-based React app under `frontend/`. | Next.js 14 + TypeScript for staff dashboard. | This remains a major architectural divergence. |
| Mobile delivery | Attendee flow is still represented inside the web frontend. | React Native (Expo) attendee mobile application. | Current implementation is useful for prototyping, but it does not satisfy the required platform split. |
| Backend layout | Active backend is TypeScript Express-only. | Node.js real-time backend plus FastAPI AI backend. | FastAPI service is still missing. |
| Data storage | In-memory demo data store with secure access controls layered on top. | Supabase primary store + Redis in-memory queue + RxDB/SQLite offline layer. | Current storage model is safer than before but still not production-safe. |
| Authentication | Access/refresh token flow, hashed passwords, RBAC, IDOR checks, strict CORS, and rate limiting are implemented. | Supabase Auth + RBAC + Google OAuth 2.0 + JWT/bcrypt requirements. | `#SPEC GAP`: this repo currently uses opaque in-memory tokens and Node `scrypt` because package install restrictions blocked bcrypt/JWT packages in this environment. |
| Routing/UI structure | Current app structure does not match the exact specification file tree. | Spec defines fixed project structure and component placement. | Structural alignment remains incomplete. |
| Table management APIs | Core promote/seat/clear actions are server-backed, but rename/capacity edits remain local-only UI controls. | Spec implies full backend-backed table management. | `#SPEC GAP`: backend contract for those mutations is still undefined in this repo. |

## Pre-Deployment Verification Checklist

Mark each item complete before any production launch:

- [ ] All blocker items above are resolved or formally accepted as documented architecture decisions.
- [ ] All required environment variables are documented and validated at startup.
- [ ] Supabase schema is finalized and migrations are reproducible.
- [ ] Redis queue behavior is implemented and load tested.
- [ ] FastAPI AI services are deployed and returning prediction data within latency targets.
- [ ] Offline sync flow has been tested with simulated connectivity loss and recovery.
- [ ] Auth/RBAC/IDOR/rate-limit/CORS controls are validated under automated test coverage.
- [ ] API error responses match the documented contract.
- [ ] Coverage threshold is met and recorded.
- [ ] Accessibility audit is complete.
- [ ] Staging environment mirrors production dependencies.
- [ ] Release, rollback, and incident-response steps are documented.

## Related Documents

- `SPEC_PROGRESS_ASSESSMENT.md` — current high-level completion estimate and phase-by-phase progress summary.
- `README.md` — repository overview and local run instructions.
- `SUPABASE_OPTION_A_SETUP.md` — current Supabase integration scaffolding notes.
