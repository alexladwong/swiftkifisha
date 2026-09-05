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
| GET    | /api/members?page=&limit=&search=    | 🔒   | Fikisha members with shipment totals |
| GET    | /api/members/:id                     | 🔒   | Member profile + hub addresses + recent parcels |
| GET    | /api/health                          | –    | Liveness check |

## International (Fikisha) model

SwiftUg Uganda mirrors the Fikisha model: members hold personal mailbox
suite numbers in seven hub countries (US, UK, UAE, Germany, China, Singapore,
Hong Kong). Seeded demo data: 2 admins, 26 members (12 home countries, 53
mailboxes) and 200 parcels (~1 in 4 are international member orders with store
names such as Amazon/Shein/noon and customs checkpoints).

Pricing is transparent and currency-aware:
- Domestic shipments within Uganda: **UGX** (Ugandan shilling per-kg table; 15 domestic cities incl. Kampala).
- International Fikisha: **USD** = hub pickup fee + destination-zone
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