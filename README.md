# Mimiz Kitchen

Mimiz Kitchen is a food ordering web app with a React, TypeScript, and Vite storefront, a Node.js API, customer order tracking, and a staff workspace.

## Run locally

Requirements: Node.js 20.19 or newer.

1. Install project packages with npm install.
2. Start the local app with npm start.
3. Open http://localhost:3000. Staff tools are at /staff.
4. On first server startup, copy the staff password printed in the terminal. To keep it stable, set MIMIZ_ADMIN_PASSWORD in .env before starting the app.

For frontend development with Vite, run node server.js in one terminal and npm run dev in another. Open the Vite URL shown in the terminal, usually http://localhost:5173.

## Features

- Browse, search, and filter a responsive menu.
- Maintain a basket and place pickup or delivery orders.
- Review totals before placing an order; the server validates item availability and calculates prices.
- Track order status and estimated preparation time.
- Customer chats and order history are attached to an anonymous, server-issued browser session, so they survive page refreshes and work across the local Vite and app ports.
- Staff dashboard for orders, menu items, and customer chats.
- Staff can add dishes with an optimized photo upload, custom category, description, label, and price; edit, mark unavailable, or archive dishes.

## Data and migration

Menu items, orders, order lines, order status history, customer sessions, and chat messages are stored in data/mimiz.sqlite with foreign-key constraints and transactional updates. On the first run after this update, the app imports existing data/store.json into SQLite. The JSON file is retained as a migration backup and is no longer the live data store. Staff-uploaded menu photos are saved under assets/img/menu.

The demo accepts pay-on-pickup or pay-on-delivery. It does not collect online payments. SQLite is a real local relational database and suits a single app instance. A public multi-instance service should use managed PostgreSQL with shared session storage and backups. Individual customer accounts, favorites, saved addresses, and cross-device history are future work; the current guest session is per browser.
