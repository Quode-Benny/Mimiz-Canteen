# Mimiz food ordering platform (v1)

This is the isolated v1 rebuild area. The current root app remains untouched. The product spec defines one company with multiple branches; launch can start with one configured branch.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS for the web app and modular API routes
- PostgreSQL with PostGIS and Drizzle migrations for domain data
- Redis for realtime fan-out and background jobs
- Provider interfaces for payments, messaging, maps, storage, and monitoring

## Run locally

1. Install and start Docker Desktop for Windows (WSL 2/Linux containers).
2. Copy .env.example to .env.
3. Run docker compose up --build. Docker Compose downloads the app dependencies and database images on first run.
4. Open http://localhost:3000.

The current work-in-progress only starts the customer landing page and local Postgres/PostGIS and Redis. Authentication, schema migrations, seed data, and order operations are not complete; do not use it for real orders. The /api/health route returns 503 until the service checks are implemented.

Pure domain tests can run with npm test --workspace @mimiz/shared.

## Zero-spend policy

Development defaults use simulated payment, console messaging, OpenStreetMap, local storage, and structured logs. Live provider credentials belong in environment variables and are not committed. Demo payments must be visibly simulated and never represented as real revenue.

## Build status

Sprint 0 is in progress. See docs/owner-readiness.md and docs/decisions.md.
