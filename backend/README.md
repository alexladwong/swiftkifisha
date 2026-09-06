# SwiftShip API (backend)

Express REST API powering both frontends in this repo. No external database is
required: data lives in a JSON file (`data/db.json`, created automatically) and
demo data is seeded on first start.

## Run

```sh
npm install
npm run dev        # node --watch, http://localhost:5001
```

Environment is configurable via `.env` (see `.env.example`): `PORT`
(default 5001), `HOST`, `JWT_SECRET`, `DB_FILE`. Port 5000 is skipped by
default because macOS "AirPlay Receiver" occupies it; the Vite dev proxies in
`../frontend` and `../dashboard` forward `/api` here.

## Demo accounts (auto-seeded on first start)

| Email                | Password  | Role  |
| -------------------- | --------- | ----- |
| admin@swiftship.com  | Admin@123 | admin |
| ops@swiftship.com    | Ops@123   | admin |

Reset the demo database anytime: `npm run seed`

## Endpoints

Auth: all routes below marked 🔒 require `Authorization: Bearer <token>`
from `POST /api/auth/login`.

| Method | Path                                 | Auth | Description |
| ------ | ------------------------------------ | ---- | ----------- |
| POST   | /api/auth/login                      | –    | { email, password } → { token, user } |
| POST   | /api/auth/add-user                   | 🔒   | Create admin { name, email, password } |
| GET    | /api/parcels?page=&limit=&search=    | 🔒   | Paginated parcel list { data, page, limit, total, totalPages } |
| POST   | /api/parcels                         | 🔒   | Create shipment; price computed server-side; returns parcel with trackingId |
| POST   | /api/parcels/:id/checkpoint          | 🔒   | Append { location, title, description, status } tracking event |
| GET    | /api/parcels/track/:trackingId       | –    | Public tracking lookup (404 if unknown) |
| POST   | /api/parcels/calculate-cost          | –    | Quote → { type, parcelCategory, price, ... } |
| GET    | /api/dashboard/stats                 | 🔒   | Totals, status/weight distributions, monthly parcels + revenue |
| GET    | /api/analytics/summary               | 🔒   | Totals + citiesServed |
| GET    | /api/analytics/revenue               | 🔒   | [{ month, revenue }] last 6 months |
| GET    | /api/analytics/parcels               | 🔒   | [{ month, parcels }] last 6 months |
| GET    | /api/analytics/top-cities            | 🔒   | [{ city, parcels }] top 5 destinations |
| GET    | /api/analytics/delivery-performance  | 🔒   | [{ month, onTime, delayed }] % per month |
| GET    | /api/shop/hubs                       | –    | Mailbox hub countries (public) |
| GET    | /api/shop/world                      | –    | Served countries + member plans (public) |
| GET    | /api/members?page=&limit=&search=    | 🔒   | Kifisha members with shipment totals |
| GET    | /api/members/:id                     | 🔒   | Member profile + hub addresses + recent parcels |
| GET    | /api/members/:id                     | 🔒   | Member profile + hub addresses + recent parcels |
| GET    | /api/health                          | –    | Liveness check |

### Commercial parcel forwarding (Phase 1 — routes in `src/routes/commerce.routes.js`)

A PACKAGE is an item received at a SwiftKifisha warehouse (a SHIPMENT/parcel is
the legacy dispatch concept). Statuses/transitions are backend-controlled
(`src/lib/commerce.js`): member responses carry `allowedActions`, admin
responses carry `allowedTransitions` — never hard-code the machine in clients.
Staff status changes, assignment, measurement corrections, receiving, package
actions, warehouse CRUD and quotes are written to the `auditLogs` collection.

| Method | Path                                    | Auth | Description |
| ------ | --------------------------------------- | ---- | ----------- |
| GET    | /api/packages?status=                   | 🔒   | Member's packages (with storage + allowedActions) |
| GET    | /api/packages/:id                       | 🔒   | Package detail (owner only) |
| POST   | /api/packages/pre-alert                 | 🔒   | Announce inbound parcel → PRE_ALERTED, id `SWPK-…` |
| POST   | /api/packages/:id/action                | 🔒   | Member action { action, note } from allowedActions; advisory actions don't move state |
| GET    | /api/account/overview-stats             | 🔒   | Real counts + action-required reasons for member overview |
| GET    | /api/mailboxes                          | 🔒   | Member's operational mailbox addresses from admin warehouses |
| POST   | /api/quotes                             | 🔒   | Quote engine: { warehouseId?, weight, declaredValue, insurance, destinationCountry, … } → `SKQ-…`, line items, 24 h expiry. Estimate, not a guaranteed price |
| GET    | /api/admin/warehouses                   | 🔒*  | Warehouse list |
| POST   | /api/admin/warehouses                   | 🔒*  | Create warehouse (name/country/city required) |
| PATCH  | /api/admin/warehouses/:id               | 🔒*  | Update warehouse (audited) |
| GET    | /api/admin/packages?status=&search=&unassigned= | 🔒* | Ops queue with filters |
| POST   | /api/admin/packages/receive             | 🔒*  | Warehouse receiving; header `Idempotency-Key` (or body idempotencyKey); double scans are safe no-ops, pre-alert rows are reused (no twin packages) |
| POST   | /api/admin/packages/:id/assign          | 🔒*  | Assign package { memberCode } or { email } |
| PATCH  | /api/admin/packages/:id/measurements    | 🔒*  | Correct weight/dims/condition with reason (audited; volumetric + chargeable recomputed) |
| POST   | /api/admin/packages/:id/status          | 🔒*  | Staff transition { status, reason } — only from allowedTransitions |
| POST   | /api/admin/packages/:id/photos          | 🔒*  | multipart `photos` (≤6 × ≤8 MB, JPEG/PNG/WebP/GIF) + `view` (front/back/label/damage/contents) |
| GET    | /api/files/packages/:filename           | 🔒   | Photo file — package owner or admin only |
| GET    | /api/admin/audit?limit=                 | 🔒*  | Audit trail (newest first, max 500) |

\* admin/support staff roles (SUPER_ADMIN, ADMIN, OPERATIONS, WAREHOUSE_MANAGER,
WAREHOUSE_AGENT). Gate is case-insensitive so existing lowercase `admin` users
qualify.

Commercial notes:

- **Carriers**: `carriers` registry — `SWIFT_INTERNAL` (internal handoff,
  CONFIGURED) plus DHL/FedEx/Aramex and MTN/Airtel rows. Everything external is
  `NOT_CONFIGURED` → *Integration prepared — provider credentials required*.
  The backend never fabricates a successful carrier booking or tracking event.
- **Payments**: none real. Packages park in `READY_FOR_PAYMENT`; paid checkout
  is Phase-2 (quote → server-verified payment → shipment creation).
- **Sync**: these collections are in `SYNC_COLLECTIONS` (warehouses, packages,
  pricingRules, carriers, auditLogs, quotes). Neon sync is merge-based
  (`push` upserts; use `removeDocs()` for explicit deletions).

## International (Kifisha) model

SwiftKifisha Uganda mirrors the Kifisha model: members hold personal mailbox
suite numbers in seven hub countries (US, UK, UAE, Germany, China, Singapore,
Hong Kong). Seeded demo data: 2 admins, 26 members (12 home countries, 53
mailboxes) and 200 parcels (~1 in 4 are international member orders with store
names such as Amazon/Shein/noon and customs checkpoints).

Pricing is transparent and currency-aware:
- Domestic shipments within Uganda: **UGX** (Ugandan shilling per-kg table; 15 domestic cities incl. Kampala).
- International Kifisha: **USD** = hub pickup fee + destination-zone
  per-kg rate × weight × category × delivery speed (min. $18).
- Dashboard/analytics revenue is reported in UGX (USD converted at the fixed
  seed rate 3700 in `src/lib/intl.js`); `revenueUSD` totals are also exposed.

Parcels now carry `originCountry`, `destinationCountry`, `currency`, and for
member shipments `storeName`, `memberId`, `memberEmail`. List filtering:
`?member=<id|email>`, `?originCountry=`, `?destinationCountry=`.

Checkpoint events include `status`, `location`, `message`, `timestamp`,
`timestamps` and `dateTime` so both timeline components (dashboard and
customer site) render them. Pricing categories/statuses/cities mirror the lists
in `frontend/src/lib/locationData.js`.

## Layout

```
src/
  server.js            entry point (starts HTTP server)
  app.js               express app + middleware + routing
  config.js            env handling
  lib/
    db.js              JSON file store + id generators
    referenceData.js   cities/categories/status definitions
    pricing.js         quote engine (domestic UGX & international USD)
    seed.js            demo dataset (2 admins, 160 parcels over 6 months)
    aggregate.js       dashboard/analytics computations
    util.js            small helpers
  middleware/auth.js   JWT guard
  routes/              auth, parcels, dashboard stats, analytics
scripts/
  smoke.js             end-to-end route tests: node scripts/smoke.js
  seed.js              regenerate demo data: npm run seed
```

## Test

```sh
npm run dev              # terminal 1
node scripts/smoke.js    # terminal 2 — exercises every endpoint
```
## Neon Postgres auto-sync (optional)

When `DATABASE_URL` is set (see `.env` / `.env.example`), the API uses your
Neon Postgres database (`neondb`, production branch) as a persistent mirror:

- **On boot**: connects to Neon, creates the `SwiftKifisha_sync` table
  (`collection`, `id`, `doc jsonb`, `updated_at`), and loads the dataset
  from Postgres when rows exist — so the API fully recovers even if the local
  JSON cache (`data/db.json`) is deleted.
- **On every write**: the local file is updated first, then the full dataset is
  pushed to Neon in one batched transaction (replace-style upsert per row).
- First boot with a populated local cache seeds Neon automatically.

Connectivity/rows can be inspected with:

```sh
cd backend
node --input-type=module -e "import { ping } from './src/lib/remoteStore.js'; const p = await ping(); const r = await p.query('SELECT collection, count(*) AS n FROM SwiftKifisha_sync GROUP BY collection'); console.log(r.rows); await p.end();"
```

Remove `DATABASE_URL` from `.env` to run purely on the local JSON file.

> Note: the Convex production backend (`convex-backend/`) keeps its own
> managed database; Neon sync applies to the Express API (`backend/`).

## Google sign-in (members)

The Express API mirrors the Better Auth social contract so both frontends work
against it unchanged:

- `GET /api/auth/social/providers` → `["google"]` when
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set (they are, in `.env`).
- `GET /api/auth/sign-in/social?provider=google&callbackURL=…` → 302 to Google.
- `GET /api/auth/callback/google?code=&state=` → exchanges the code, finds or
  creates the user (new accounts become members with the Saver mailbox
  profile; existing admins keep their role), sets the `sk_session` cookie and
  redirects to `callbackURL`.
- `GET /api/auth/social/session` → returns `{ token, user }` from the cookie so
  the frontend `/auth/callback` page can store the session like an email login.

**Google console setup** — Authorized redirect URIs must include (add both for
local dev; register any deployed frontend origin too):
- `http://localhost:5173/api/auth/callback/google`
- `http://localhost:5174/api/auth/callback/google`

The Convex deployment uses the same OAuth client with
`https://precise-pig-300.convex.site/api/auth/callback/google`. Admin dashboard
login is passwordless email+OTP (see `/api/auth/admin/otp/*`); Google sign-in
is for members on the customer site.
