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
- Current repository state is best treated as a **prototype / scaffold**, not a production-ready implementation.

## Production Blockers

| Priority | Area | Current State | Spec Expectation | Action Required |
|---|---|---|---|---|
| Blocker | Architecture | Repo currently contains a Vite-based frontend and an Express backend scaffold. | Spec requires a hybrid platform with Next.js 14 for staff web, React Native (Expo) for attendee mobile, Node.js + Express for real-time logic, and FastAPI for AI services. | Split or migrate the codebase to the required production architecture and document any approved deviations. |
| Blocker | AI Service | No FastAPI AI application is present in the active backend implementation. | Spec requires a Python FastAPI layer for LSTM forecasts and Monte Carlo predictions. | Implement the `app/` Python service layer and connect it to prediction workflows. |
| Blocker | Offline-first | No RxDB + SQLite local-first client implementation is present. | Spec requires offline operation with delta-sync for dead-zone resilience. | Implement local-first storage, sync queueing, and conflict resolution behavior. |
| Blocker | Authentication | Backend auth uses in-memory users/tokens and plaintext password comparison. | Spec requires Supabase Auth + RBAC, Google OAuth 2.0, JWT-based sessions, bcrypt hashing, and refresh-token handling. | Replace demo auth with production auth, hashed passwords, token expiry, RBAC checks, and OAuth integration. |
| Blocker | Persistence | Core application data is stored in an in-memory demo store by default. | Spec requires Supabase as the primary relational store and Redis for high-speed queue updates. | Migrate event, account, party, notifications, and table operations to persistent infrastructure. |
| Blocker | Testing | No evidence of the required 70% coverage baseline for utilities and API routes. | Spec requires minimum test coverage thresholds before phase gates can pass. | Add unit/integration tests, coverage reporting, and CI enforcement. |
| Blocker | Security | Rate limiting, strict CORS, IDOR checks, refresh-token invalidation, and role enforcement are incomplete or absent. | Spec lists these as non-negotiable production requirements. | Implement and validate each security requirement before release. |
| Blocker | Deployment Readiness | No staging/production deployment pipeline or operational runbook is documented in the active app directories. | Spec requires distinct development, staging, and production environments. | Add deployment documentation, environment strategy, and release runbooks. |

## Required Before Production

| Priority | Area | Current State | Spec Expectation | Action Required |
|---|---|---|---|---|
| Required Before Production | Queue Lifecycle | Queue operations support basic join/promote/seat flows, but not the full spec-defined lifecycle and notification persistence. | Status transitions and notification logging should support robust queue automation. | Implement complete state transitions, TTL handling, no-show flows, and notifications persistence. |
| Required Before Production | API Contracts | Some required endpoints exist, but the API surface is still scaffold-level and not fully aligned to the spec naming and validation rules. | API contract should match the technical specification, including event types and offline sync semantics. | Audit all routes against the spec and align payload validation, response formats, and error codes. |
| Required Before Production | Config Validation | Environment examples exist, but startup does not fail-fast through Zod-validated configuration. | Spec requires configuration validation at backend startup. | Add centralized environment validation and abort boot on missing required keys. |
| Required Before Production | Redis | No active Redis-backed FIFO/buffer implementation was found. | Spec requires Redis for sub-200ms queue updates. | Introduce Redis-backed queue primitives and document fallback behavior. |
| Required Before Production | Mobile App | No React Native / Expo attendee application is present in the active implementation. | Spec requires a mobile attendee experience separate from the staff web app. | Build or extract the attendee mobile app into the required stack. |
| Required Before Production | Accessibility | No completed WCAG 2.1 AA audit artifacts were found. | Spec requires keyboard accessibility, focus states, labels, and contrast compliance. | Perform an accessibility audit and fix issues before release. |
| Required Before Production | Observability | Logging, metrics, and production alerting are not documented. | A high-availability queue platform needs production visibility. | Add structured logs, health checks, metrics, and incident alerting. |

## Known Divergences From Spec

| Area | Current Implementation | Spec Requirement | Notes |
|---|---|---|---|
| Frontend framework | Vite-based React app under `frontend/`. | Next.js 14 + TypeScript for staff dashboard. | This is a major architectural divergence and must be resolved or explicitly approved. |
| Mobile delivery | Attendee flow is currently represented inside the web frontend. | React Native (Expo) attendee mobile application. | Current implementation is useful for prototyping, but it does not satisfy the required platform split. |
| Backend layout | Active backend is TypeScript Express-only. | Node.js real-time backend plus FastAPI AI backend. | FastAPI service is missing. |
| Data storage | In-memory demo data store with optional Supabase scaffolding. | Supabase primary store + Redis in-memory queue + RxDB/SQLite offline layer. | Current storage model is not production-safe. |
| Authentication | Demo email/password flow with local token storage patterns. | Supabase Auth + RBAC + Google OAuth 2.0. | Current implementation should not be exposed publicly. |
| Routing/UI structure | Current app structure does not match the exact specification file tree. | Spec defines fixed project structure and component placement. | Structural alignment remains incomplete. |

## Pre-Deployment Verification Checklist

Mark each item complete before any production launch:

- [ ] All blocker items above are resolved or formally accepted as documented architecture decisions.
- [ ] All required environment variables are documented and validated at startup.
- [ ] Supabase schema is finalized and migrations are reproducible.
- [ ] Redis queue behavior is implemented and load tested.
- [ ] FastAPI AI services are deployed and returning prediction data within latency targets.
- [ ] Offline sync flow has been tested with simulated connectivity loss and recovery.
- [ ] Auth/RBAC/IDOR/rate-limit/CORS controls are validated.
- [ ] API error responses match the documented contract.
- [ ] Coverage threshold is met and recorded.
- [ ] Accessibility audit is complete.
- [ ] Staging environment mirrors production dependencies.
- [ ] Release, rollback, and incident-response steps are documented.

## Related Documents

- `SPEC_PROGRESS_ASSESSMENT.md` — current high-level completion estimate and phase-by-phase progress summary.
- `README.md` — repository overview and local run instructions.
- `SUPABASE_OPTION_A_SETUP.md` — current Supabase integration scaffolding notes.

