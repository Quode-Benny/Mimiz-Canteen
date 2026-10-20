# Owner inputs and local setup

## Needed to run the app locally

- Install Docker Desktop for Windows, enable its WSL 2/Linux container backend, and leave Docker running. Docker Compose will start Postgres with PostGIS and Redis; install neither separately.
- Node.js 20.9 or newer and npm. The machine used to prepare this scaffold already has Node 24.18 and npm 11.16.
- Allow npm and Docker to download packages/images on first setup. No paid accounts or provider keys are required for the zero-spend demo.

## Needed before catalogue and branch acceptance

Prepare one row per branch. The product model supports multiple branches; the first launch can have one.

- Company and branch name, phone, address, map pin coordinates, opening hours, closures, pickup/delivery settings, prep-time estimate.
- Delivery areas (radius or boundary), fee, minimum order, and expected delivery minutes.
- Staff list with name, email or phone, role, and branch assignment.
- Menu spreadsheet with category, item name, description, GHS price, image, active status, tags, dayparts, option groups/options, and hard availability windows.
- Brand logo, colours, contact information, terms, privacy notice, cancellation and refund policy.
- Service fee and tax rules; confirm applicable Ghana tax treatment with the business accountant.

## Only needed for real integrations or launch

Paystack keys, SMS sender/provider credentials, Google Maps keys (if switching from OSM), S3 credentials, email provider key, Sentry DSN, domain and hosting are all deferred. Provider interfaces and mock modes are being built first.
