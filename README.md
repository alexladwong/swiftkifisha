# Courier Management System

Full-stack courier management system ("SwiftShip / SwiftKifisha") with three apps:

| App         | Folder      | Tech                              | URL (dev)              |
| ----------- | ----------- | --------------------------------- | ---------------------- |
| **API**     | `backend/`    | Node + Express (JSON persistence) | http://localhost:5001  |
| **Website** | `frontend/`  | Vite + React + shadcn/ui (public) | http://localhost:5173  |
| **Admin**   | `dashboard/` | Vite + React + shadcn/ui (admin)  | http://localhost:5174  |

## What it is

A **Kifisha courier service for an international audience** (inspired by
Aramex): members get personal mailbox suite numbers in seven hub
countries (USA, UK, UAE, Germany, China, Singapore, Hong Kong), shop any store
there, and SwiftKifisha consolidates and delivers to their door in 50+ countries.

- **Public site**: Kifisha overview (`/shop-ship`) with mailbox addresses
  and plans, international fee estimator (`/calculate`, USD international /
  UGX domestic), worldwide tracking (`/track`).
- **Admin dashboard**: parcel management plus a **Kifisha Members** page
  (`/members`) showing member plans, mailbox hubs, shipment totals and
  per-member parcels.
- **Demo data** (auto-seeded): 2 admins, 26 members and 200 parcels spanning
  domestic and international member shipments across the last 6 months.

- **International (i18n)**: the customer site speaks English, Spanish, French,
  Arabic (RTL) and Simplified Chinese — pick a language from the header/footer
  switcher (persisted; default follows the browser). Copy lives in
  `frontend/src/i18n/{en,es,fr,ar,zh}.js`; `node scripts/check-i18n.cjs`
  verifies every language mirrors English key-for-key.
- **Auth**: email+password sign-up/sign-in, forgot/reset password pages
  (`/forgot-password`, `/reset-password` on both apps), and Google + LinkedIn
  social sign-in through Better Auth (credential setup in
  `convex-backend/README.md`).

The two web apps proxy every `/api` request to the backend
(`vite.config.js` — override with the `API_PROXY` env var if you move the API).

## Backends

Two interchangeable API implementations expose the same REST contract:

| Backend | Folder | Status |
| ------- | ------ | ------ |
| **Local Express API** (demo/development) | `backend/` | Runs now on port 5001, seeded, fully smoke-tested |
| **Convex + Better Auth** (production) | `convex-backend/` | **Deployed & live-verified** on `precise-pig-300` (`https://precise-pig-300.convex.site`): Better Auth login, parcels/members/stats/analytics REST bridge, seeded demo data (see `convex-backend/README.md`) |

To point the web apps at Convex instead of Express, set in each app's
`.env.local`: `VITE_API_BASE_URL=https://precise-pig-300.convex.site/api`
(or run the dev servers with `API_PROXY=https://precise-pig-300.convex.site`).
Templates: `frontend/.env.example`, `dashboard/.env.example`.

> Known environment quirk: an external process on this machine occasionally
> rewrites source files with stale tokens (SwiftKifisha -> SwiftKifisha, Uganda ->
> Uganda, UGX -> UGX). If copy or identifiers look wrong, run:
> `node scripts/restore-brand-tokens.cjs`

> **Going live?** Read [`DEPLOY.md`](DEPLOY.md) first — deployment checklist,
> secrets handling, Google OAuth URIs and `/api` proxying.

## Quick start

```sh
# 1. API (port 5001) — seeds demo data on first start
cd backend
npm install
npm run dev

# 2. Public website (port 5173)
cd ../frontend
npm install
npm run dev

# 3. Admin dashboard (port 5174)
cd ../dashboard
npm install
npm run dev
```

Then open:
- **Website** → http://localhost:5173 (track a parcel, calculate shipping cost)
- **Dashboard** → http://localhost:5174

### Admin login

| Email               | Password  |
| ------------------- | --------- |
| admin@swiftship.com | Admin@123 |
| ops@swiftship.com   | Ops@123   |

The API seeds ~160 demo parcels across the last 6 months, so the dashboard
cards, charts and the analytics page have realistic data immediately. Reset
anytime with `npm run seed` inside `backend/`.

> Note: the API defaults to port **5001**, not 5000, because macOS
> "AirPlay Receiver" listens on 5000. If the port is free on your machine you
> may set `PORT=5000` in `backend/.env` — the proxies then pick it up via
> `API_PROXY=http://localhost:5000 npm run dev`, or keep the default.

See `backend/README.md` for the full API reference.