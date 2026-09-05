# SwiftPak Global — Convex backend (precise-pig-300)

Convex re-implementation of the SwiftPak shop-and-ship API with Better Auth,
preserving the REST contract the two frontends call (dashboard + customer site).

**Status: DEPLOYED and verified live.** Code is running on the production
deployment `precise-pig-300` (project ticketspro, team
ambassador-alex-ladwong): https://precise-pig-300.convex.cloud /
https://precise-pig-300.convex.site — Better Auth login, admin guards, parcel
CRUD/checkpoints, quotes (byte-identical to the Express API), dashboard stats,
analytics, members and shop hubs were all verified over HTTPS (see
"Live verification" below). The local Express API in ../backend remains the
zero-setup demo backend; it also feeds the parity harness.

## Quick start (requires your Convex account)

```sh
cd convex-backend
npm install

# 1. Link this folder to your Convex project (project id is already in convex.json):
npx convex login        # opens a browser; paste the returned token back into the CLI
npx convex dev          # keep running - deploys to a dev deployment & generates types
```

While `convex dev` runs, in a second terminal:

```sh
cd convex-backend
# 2. Secrets (values live in the Convex dashboard / env, never in git)
npx convex env set BETTER_AUTH_SECRET $(openssl rand -base64 32)
npx convex env set SITE_URL http://localhost:5174

# 3. Seed demo data (2 admins, ~12 members, ~64 parcels)
npx convex run seed:all '{}'
# reseed from scratch:  npx convex run seed:all '{ "force": true }'

# 4. Deploy to production (your project precise-pig-300, currently undeployed)
npx convex deploy --prod
```

Better Auth endpoint routes are generated from `convex/betterAuth/auth.ts`; after
changing auth options, regenerate the component schema:

```sh
npm run auth:generate   # npx auth generate --config ./convex/betterAuth/auth.ts --output ./convex/betterAuth/schema.ts
```

## Pointing the frontends at Convex

Both frontends call the API through `VITE_API_BASE_URL` (axios) with paths such
as `/auth/login`, `/parcels`, `/dashboard/stats`. To run them against Convex
instead of the local Express API:

```sh
# in frontend/ and dashboard/: create .env.local with
VITE_API_BASE_URL=https://precise-pig-300.convex.site/api

# or, for local dev through the Vite proxy (same-origin, no CORS):
API_PROXY=https://precise-pig-300.convex.site npm run dev
```

## REST surface (identical shapes to ../backend)

| Method | Path | Auth | Convex function |
|---|---|---|---|
| POST | /api/auth/login | – | authbridge.login (Better Auth email+password; returns {token,user}) |
| POST | /api/auth/add-user | Bearer admin | authbridge.addUser |
| GET | /api/parcels?page&limit&search&member&originCountry&destinationCountry | Bearer admin | parcels.list |
| POST | /api/parcels | Bearer admin | parcels.create |
| GET | /api/parcels/track/:trackingId | – | parcels.track (incl. customer alias keys) |
| POST | /api/parcels/calculate-cost | – | parcels.quote |
| POST | /api/parcels/:id/checkpoint | Bearer admin | parcels.addCheckpoint |
| GET | /api/dashboard/stats | Bearer admin | stats.dashboard |
| GET | /api/analytics/{summary,revenue,parcels,top-cities,delivery-performance} | Bearer admin | analytics.* |
| GET | /api/members, /api/members/:id | Bearer admin | members.list / members.detail |
| GET | /api/shop/hubs, /api/shop/world | – | shop.hubs / shop.world |
| GET | /api/health | – | – |

Better Auth also mounts its native endpoints under `/api/auth/*` (e.g.
`/api/auth/sign-in/email`, `/api/auth/get-session`) for future member
sign-up/sign-in flows, plus the Convex-native auth provider configured in
`convex/auth.config.ts`.

## Layout

```
convex/
  convex.config.ts            app definition; mounts the betterAuth component
  auth.config.ts              Convex auth provider = Better Auth (RS256 JWKS)
  schema.ts                   domain tables: admins, members, parcels
  betterAuth/                 locally-installed Convex component
    convex.config.ts          component definition ("betterAuth")
    auth.ts                   Better Auth instance + component client
    schema.ts                 GENERATED auth tables (user/session/account/verification)
    adapter.ts                component CRUD api
  lib/                        intl data, pricing, aggregations, admin authz
  parcels.ts members.ts stats.ts analytics.ts shop.ts authbridge.ts seed.ts
  http.ts                     REST bridge + Better Auth route registration
  _generated/                 LOCAL STUBS (codegen output once convex dev runs)
```

## Notes / known constraints

- `convex/_generated/*` currently contains lightweight local stubs so tooling
  (e.g. the auth schema generator) works before your first `npx convex dev`;
  Convex codegen overwrites them automatically.
- Admin authorization: bearer session token is validated per call against the
  Better Auth session table; dashboard access additionally requires the email
  in the `admins` table.
- Custom `/api/auth/login` and `/api/auth/add-user` exact routes are registered
  next to the Better Auth prefix router; if a future Better Auth version
  complains about overlapping paths, move them to `/api/login` and
  `/api/add-user` in `convex/http.ts` (one-line change, update the dashboard
  slice URL accordingly).

## Live verification (production)

```sh
# End-to-end checks that all passed against https://precise-pig-300.convex.site:
# - GET /api/health
# - POST /api/auth/login (admin@swiftship.com / Admin@123 -> { token, user.role: admin });
#   wrong password -> 401
# - GET /api/parcels (Bearer) -> 401 without token; paged rows with auth
# - GET /api/parcels/track/:id (public, alias keys + checkpoints)
# - POST /api/parcels/calculate-cost: UGX domestic (Kampala-Jinja etc.) + USD international,
#   international quote byte-identical to the Express API
# - POST /api/parcels + POST /api/parcels/:id/checkpoint (write paths)
# - POST /api/auth/add-user: creates Better Auth user + admin row, duplicate -> 409
# - GET /api/dashboard/stats, /api/analytics/*, /api/members, /api/shop/* (Bearer)
# Seeded: 2 admins, 12 members, 64 parcels (reseed: convex run seed:all '{"force":true}')
```

Environment variables set on production: `BETTER_AUTH_SECRET` and
`SITE_URL`. Commands in this folder run against production with
`CONVEX_DEPLOYMENT=prod:precise-pig-300` (or run `npx convex dev` /
`--configure existing` interactively on your machine to select the project).

## Parity verification (run locally, no Convex account needed)

`npm run parity` executes the Convex TypeScript logic (pricing, zone tables,
monthly series, status/weight distributions, delivery performance) side by
side with the Express implementation over the same seeded dataset
(`../backend/data/db.json`) and asserts identical output:

- pricing matrix across shipment types, 10 categories, 3 delivery speeds,
  7 weights and 7x7 origin/destination hub countries (27,090 combinations)
- all analytics aggregations, including USD->UGX revenue conversion

Current state: ALL PARITY CHECKS PASSED.

## Why not @better-auth/infra directly?

`npm i @better-auth/infra` targets self-hosted / framework edge servers
(Cloudflare, Vercel, Node). On Convex the supported integration is the
`@convex-dev/better-auth` component used here (maintained by Convex), which
handles the HTTP endpoints, session storage and Convex-native auth wiring, so
`@better-auth/infra` is intentionally not installed. The Better Auth CLI
(`npx auth init` / `npx auth generate`) is still used to manage the auth
config and component schema.