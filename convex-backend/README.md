# SwiftKifisha Global — Convex backend (precise-pig-300)

Convex re-implementation of the SwiftKifisha Kifisha API with Better Auth,
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
| POST | /api/auth/forgot-password | – | authbridge.forgotPassword ({email, origin?} → {message, devResetLink?}) |
| POST | /api/auth/reset-password | – | authbridge.resetPassword ({token, newPassword}) |
| GET | /api/auth/social/providers | – | env-driven list of configured social providers |
| GET | /api/auth/social/session | session cookie | authbridge.socialSession (OAuth callback → {token,user}) |
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
- Password reset is owned by the custom bridge above — NOT by Better Auth's
  native `request-password-reset` flow. The exact `/api/auth/reset-password`
  route intentionally shadows the Better Auth prefix handler, so do not enable
  Better Auth's `sendResetPassword` (native tokens could never be redeemed).
- Reset tokens: one outstanding token per email (requesting a new one
  invalidates the old), 60-minute TTL, single-use, stored in the `resetTokens`
  table. No email provider is configured yet: outside production the reset
  link is logged and returned as `devResetLink` (built from the caller's
  Origin, falling back to `FRONTEND_URL`/`SITE_URL`/localhost:5173). In
  production the link is only logged unless `RESET_LINK_DEBUG=true` — see
  `.env.example`.

## Social sign-in (Google)

Better Auth ships built-in OAuth providers; this deployment exposes
**Google**. It activates only when both credentials exist in the env — set
them with `npx convex env set …` and see `.env.example`:

| Variable | Value |
|---|---|
| BETTER_AUTH_GOOGLE_ID | Google OAuth client ID |
| BETTER_AUTH_GOOGLE_SECRET | Google OAuth client secret |

The Google OAuth app must whitelist the **redirect URI**
`https://precise-pig-300.convex.site/api/auth/callback/google`. The sign-in
UIs fetch `GET /api/auth/social/providers` and only
render buttons for configured providers, then send users to Better Auth's
native `/api/auth/sign-in/social?provider=…&callbackURL=…`. After the provider
round-trip, the frontend callback page exchanges the session cookie for the
regular `{ token, user }` contract via `GET /api/auth/social/session`
(authbridge.socialSession); first social sign-in auto-provisions a member
profile (same defaults as email sign-up).

> Email: password-reset delivery on Convex uses the Brevo API when
> `SENDINBLUE_API_KEY` is set (SMTP sockets are not available in the Convex
> runtime). The Express backend (`../backend`) delivers through the Hostinger
> SMTP credentials in its `.env`.

> Cross-origin deployments: when the frontends call the Convex site directly
> (`VITE_API_BASE_URL=https://…convex.site/api`), set `CROSS_SITE_AUTH=true` so
> session cookies use SameSite=None over HTTPS. If `/api` is same-origin or
> reverse-proxied (like the Vite dev proxy), leave it unset.

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