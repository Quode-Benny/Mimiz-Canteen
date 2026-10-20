# Decisions

## D-001: Isolated v1 build

The existing app is preserved at the workspace root. The new platform is being developed under sandbox/food-ordering-v1 because the workspace is not a Git repository, so a feature branch cannot be created here.

## D-002: Branch model

The Main Spec one-company/multiple-branch model is retained. The launch may configure one operating branch first; schemas and APIs must remain branch-scoped for future branches.

## D-003: Zero-spend provider defaults

Development defaults use mock payment, console messaging, OSM mapping, local storage, and structured logs. Live provider credentials stay in environment variables and are not committed. Demo payments must be visibly simulated and must never be represented as real revenue.

## D-004: Database choice

Use PostgreSQL + PostGIS as required by the Main Spec and Addendum. Docker is the local runtime. ORM choice is Drizzle for explicit SQL migrations and compatibility with PostGIS-specific SQL.

## D-005: Incremental delivery

Follow the supplied sprint order. Do not call Sprint 0 complete until its authentication/RBAC and seed acceptance checks are runnable.
