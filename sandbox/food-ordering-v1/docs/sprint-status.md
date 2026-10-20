# Sprint status

## Sprint 0 — foundations (in progress)

### In place

- Isolated Next.js App Router + TypeScript + Tailwind workspace; existing root app preserved.
- Local Compose definitions for the web app, PostgreSQL/PostGIS, and Redis; PostGIS extension bootstrap.
- Zero-spend environment template and production guard for mock payment/console messaging.
- Shared order-state and integer-pesewa primitives; provider contracts/resolver; branch-scoped authorization helpers.
- First responsive customer landing screen uses the existing local food photography.
- Unit checks for order transitions, money validation, provider selection, branch scope, price permissions, and demo production safety.

### Not done yet

- Database migrations and full Sprint 0 schema/seed data.
- Customer OTP and staff password authentication, persistent sessions, OTP limits, and Dev Inbox.
- Wiring server-side RBAC on all routes, audit writes, protected Integration Status screen.
- Web health checks for Postgres, Redis, and job queue.
- Full typecheck/build and end-to-end verification.

### Environment blocker

Docker Desktop is not installed in the current environment, and package downloads timed out. The local service stack and Next.js build cannot yet be started or fully verified here.
