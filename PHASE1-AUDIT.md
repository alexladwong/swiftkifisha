# SwiftKifisha — Commercial Platform Audit + Phase 1 Report

> Status: working document, updated during Phase-1 implementation.
> No mock data, no simulated carrier/payment successes. Anything requiring a
> provider's credentials is explicitly marked **Integration prepared — provider
> credentials required.**

---

## 1. Current architecture found

| Layer | Tech | Where | Notes |
|---|---|---|---|
| Member frontend | React 18 + Vite + Redux + Tailwind, shadcn-style UI | `frontend/` (:5173, Vercel `swiftkifisha.vercel.app`) | Auth gate via Redux token (`localStorage`), membership gate in `PortalShell`, account pages under `/account/*` |
| Admin dashboard | React + Vite + Redux + Tailwind | `dashboard/` (:5174, Vercel `swiftkifisha-dashboard.vercel.app`) | `ProtectedRoute` + `DashboardLayout`, OTP/dev admin login |
| API backend | Express (ESM) on Node | `backend/` (local :5001, prod `https://api.eazyjobs.info/api`) | JWT bearer auth, `requireAuth`, role-gated routes |
| Persistence | JSON file `backend/data/db.json` (in-memory source of truth) + Neon Postgres mirror table `SwiftKifisha_sync(collection,id,doc)` | `backend/data`, Neon `DATABASE_URL` | Boot pulls Neon → adopts remote dataset; every write persists file + merge-pushes Neon (`remoteStore.push`) |
| Optional mirror | Convex (`prod:precise-pig-300`) | `convex-backend/` | Better-Auth sessions + data mirror (sync script); not the operational store |
| Email | Hostinger SMTP custom TLS client | `backend/src/lib/mailer.js` | Real outbound; failures logged, never block saves |

Routes mounted in `backend/src/app.js` at `/api*`: auth, parcels, dashboard/stats, analytics, members, shop, membership, notifications (contact/messages/announcements), commerce (Phase-1).

### Auth summary (found, kept intact)
- Members: email+password `/api/auth/login` / `signup`; Google OAuth `/api/auth/sign-in/social` + `/api/auth/callback/google` (Express) with Convex mirror routes.
- Admin: email-OTP (`/api/auth/admin/otp/*`); dev-only fallback `/api/auth/admin/dev-login` (404 when `NODE_ENV=production`); passwordless `info@ladwongdevelopers.dev`.
- Sessions: JWT bearer (7d), stored in `localStorage`; Redux single source of truth.
- CORS: explicit allow-list (local 5173/5174, two Vercel origins, `CORS_ORIGINS` env), credentials true, **no wildcard**.

## 2. Existing commercial features — status matrix

Legend: ✅ working · 🟡 partial/backend-only · 🔵 backend-only (UI pending) · ⛔ missing · ⏳ prepared, needs provider

| # | Area | Status | Evidence |
|---|---|---|---|
| 1 | Registration / membership application + admin accept/investigate/cancel | ✅ | `membership.routes.js`, dashboard `MembershipApplications.jsx`, `BecomeMember.jsx`; mailboxes provisioned on accept |
| 2 | Personal mailbox addresses | ✅ | `HUB_COUNTRIES`/`intl.js`, member `hubAddresses`, `/api/mailboxes`; admin warehouse addresses feed them |
| 3 | Package pre-alert | ✅ (API) / 🔵 (UI in progress) | `POST /api/packages/pre-alert` → `SWPK-xxxxxx` PRE_ALERTED; warehouse queue shows expected packages |
| 4 | Warehouse receiving (scan / assign / capture) | ✅ (API) / 🔵 (UI in progress) | `POST /api/admin/packages/receive`, idempotent via `Idempotency-Key`, double-scan no-op, pre-alert row reuse (no twins) |
| 5 | Package assignment by mailbox/member code | ✅ | `POST /api/admin/packages/:id/assign` (audited) |
| 6 | Package details + photos | ✅ (API) / 🔵 (UI in progress) | GET `/api/packages/:id`; admin photo upload `POST /admin/packages/:id/photos` (JPEG/PNG/WebP/GIF ≤8 MB, ≤6 files), access-controlled files `/api/files/packages/:filename` |
| 7 | Measurements/weight/condition + corrections | ✅ | `PATCH /api/admin/packages/:id/measurements` with staff reason; volumetric/chargeable recompute; audited |
| 8 | Package status state machine | ✅ | `backend/src/lib/commerce.js`: 18 statuses, staff `POST /admin/packages/:id/status` only via `allowedTransitions`, member actions only via `allowedActions`; invalid transitions → 409 |
| 9 | Member package actions (ship/consolidate/repack/hold/return/dispose/report) | ✅ (API) / 🔵 (UI in progress) | `POST /api/packages/:id/action`; advisory `requestPhotos`/`reportProblem` do not move state |
| 10 | Shipping quote engine | ✅ (API) / 🔵 (UI in progress) | `POST /api/quotes`: warehouse→destination, weight, declared value, insurance → quoteId `SKQ-xxxxxx`, line items, 24 h expiry, persisted |
| 11 | Overview operational cards | 🔵 (API ready, UI in progress) | `GET /api/account/overview-stats` real counts + action-required reasons |
| 12 | Carrier multi-adapter layer | ⏳ | `carriers` collection: SWIFT_INTERNAL (internal handoff, CONFIGURED); DHL/FEDEX/ARAMEX/MTN/Airtel = **Integration prepared — provider credentials required** |
| 13 | Shipment creation | 🟡 | Status machine reaches SHIPMENT_CREATED/DISPATCHED via staff handover; a paid checkout (quote → payment → shipment) is Phase-2 money work; no fake bookings |
| 14 | Tracking events | 🟡 | Legacy parcel tracking exists (member/admin); package/shipment events only from staff updates — no fabricated carrier events |
| 15 | Webhooks | ⛔ | No endpoint yet (Phase-5 hardening); carrier APIs not configured |
| 16 | Customs declaration | ⛔ | Phase-3; only `hazardousReview` flag today |
| 17 | Prohibited/restricted goods | 🟡 | `hazardous` flag on receive + review reason in action-required; content/configurable rules Phase-3 |
| 18 | Address book | ✅ (found) | member `/account/addresses` (`AddressesSection`), member record addresses |
| 19 | Checkout / payments | ⛔ | **Phase 2.** No fake payment path; statuses READY_FOR_PAYMENT exist so money flow attaches cleanly |
| 20 | Wallet/credit, invoices, ledger | ⛔ | Phase 2; `payments` collection referenced defensively (`|| []`) |
| 21 | Storage fees | ✅ (API) | pricing rule `storage.freeDays`/`storage.dailyRateUSD`; per-package `storageInfo` (freeUntil, overdueDays) returned to UI |
| 22 | Insurance | 🟡 | Quote line (rate `insurance.ratePct`), marked estimate; real policy/claims = Phase 3/4 |
| 23 | Claims | ⛔ | Phase 4 |
| 24 | Support center | 🟡 | Flat contact messages exist (admin inbox, member thread, unread, email); **thread/ticket upgrade is spec'd next (Phase 4)** |
| 25 | Notifications (in-app/email) | ✅ (found) | member bell `/api/notifications/summary`, announcements, unread counts; email on package received |
| 26 | Documents center / POD | ⛔ | Phase 4 (photo files already access-controlled) |
| 27 | Admin ops queues / customer 360 / global search | 🟡 | Package queue endpoints exist (filters); ops command-center dashboard is a later phase |
| 28 | Audit log | ✅ | `auditLogs` collection; receiving/assignment/measurements/status/actions/warehouse CRUD audited with actor identity |
| 29 | RBAC roles | 🟡 | Role model `SUPER_ADMIN/ADMIN/OPERATIONS/WAREHOUSE_MANAGER/WAREHOUSE_AGENT/CUSTOMER_SUPPORT/FINANCE` prepared; DB today holds `admin`/`member`; gates case-insensitive on admin set |
| 30 | Fraud/security | 🟡 | CORS allow-list, JWT expiry, controlled file access, input validation, idempotency, audit. **Missing: rate limiting / auth+OTP throttle, helmet headers (see §10)** |
| 31 | Customer verification (KYC) | ⛔ | No provider — internal `UNVERIFIED…` status not implemented (intentionally no fake KYC) |
| 32 | Business accounts | ⛔ | Postponed by design |

## 3. Missing commercial features (priority order per brief)
1. **Phase 2 — Money**: checkout, provider-verified payments (MTN/Airtel/card adapters — **provider credentials required**), invoices, wallet/ledger, payment status machine, reconciliation.
2. **Phase 2/3**: storage-fee billing run; pricing management UI.
3. **Phase 3 — International**: customs declarations + items + HS codes, consolidation/repacking workflows end-to-end, restricted-goods rules engine (origin/destination/carrier), service availability (route) config.
4. **Phase 4 — Customer service**: support thread/ticket ops center (detailed spec already received), claims with attachments + resolution, notifications preferences, documents center, POD.
5. **Phase 5 — Hardening**: RBAC provisioning UI, rate limiting, webhook verification + endpoint, observability (request IDs), `/api/ready`, demo-data purge before commercial go-live.

## 4. Database changes (implemented in Phase-1)
- New `warehouses` — admin-managed origin hubs (7 seeded from `HUB_COUNTRIES`, code/name/country/city/addressLines/phone/timezone/currency/status/capabilities/supportedCarriers/operatingHours).
- New `packages` — the forwarding unit: id `SWPK-…`, customer/memberCode, merchant + merchant tracking, warehouse, receivedAt, status machine state, weight/dims/volumetric/chargeable, condition, photos, declared value/currency, storage fields, notes/special handling/hazardous, `lastCustomerAction`.
- New `pricingRules` — backend-owned config: storage free days/daily rate, repack/consolidation fees, insurance %, handling fee, base USD/kg.
- New `carriers` — provider registry w/ integration type + status (CONFIGURED | NOT_CONFIGURED).
- New `quotes` — persisted quote entities (quoteId, line items, expiry).
- New `auditLogs` — immutable append-only staff/customer action trail.
- All added to `SYNC_COLLECTIONS` (Neon mirror) + boot merge + seeds (`seedCommerceDefaults`), idempotent.
- Sync semantics hardened: **merge push (no delete-and-replace)** + explicit `removeDocs()` — a stale/partial writer can no longer wipe collections remotely.

## 5. Backend APIs added (Phase-1 core, all mounted at `/api`)
Member: `GET /packages` (+`?status`), `GET /packages/:id`, `POST /packages/pre-alert`, `POST /packages/:id/action`, `GET /account/overview-stats`, `GET /mailboxes`, `POST /quotes`.
Admin (role-gated): `GET|POST /admin/warehouses`, `PATCH /admin/warehouses/:id`, `GET /admin/packages` (filters), `POST /admin/packages/receive` (Idempotency-Key), `POST /admin/packages/:id/assign`, `PATCH /admin/packages/:id/measurements`, `POST /admin/packages/:id/status` (machine-validated), `POST /admin/packages/:id/photos` (multer, validated), `GET /admin/audit`.
Files: `GET /files/packages/:filename` — owner or admin only.
Status payloads include `allowedActions` (member) / `allowedTransitions` (admin) so the UI never hard-codes the machine.

## 6. Member UI changes (Phase 1)
- New `/account/packages` (My Packages with status filters), `/account/packages/pre-alert`, `/account/packages/:id` (detail: photos, storage, timeline, backend-driven actions, in-page quote), `/account/mailboxes` (operational address + copy).
- Overview: real operational stat cards + action-required list (existing content kept).
- Portal nav expanded (additive, no redesign); all data via API with loading/error/empty states; refresh-survival inherent (server is state).

## 7. Admin UI changes (Phase 1)
- New `/warehouses` (manage hubs), `/receiving` (scan → capture → assign workflow w/ idempotency), `/packages` (queue + detail dialog: assign/measurements/status machine/photos/audit).
- Sidebar entries added under protected layout (additive). Existing pages untouched.

## 8. Carrier integrations — real vs pending
- **Real today**: `SWIFT_INTERNAL` internal warehouse→carrier handover state only (label/handoff inside our own ops) — no third-party booking.
- **Pending**: DHL, FedEx, Aramex, and local postal adapters: **Integration prepared — provider credentials required.** Adapter interface (rates/book/label/track/validate) is the Phase-1+ target shape; nothing simulates a successful carrier response.

## 9. Payment integrations — real vs pending
- **None real yet** — by design no fake success: quote is an estimate; packages wait in `READY_FOR_PAYMENT`; staff may not create shipments without payment (Phase-2 gate).
- **Pending**: MTN MoMo, Airtel Money (registry rows `NOT_CONFIGURED`), card/bank later. **Integration prepared — provider credentials required.**

## 10. Security risks (open items)
1. **No rate limiting / OTP throttling** on auth, contact, or OTP routes (addressed in hardening phase; high priority before go-live).
2. `JWT_SECRET` falls back to a dev value when unset — production must set it (and `NODE_ENV=production` gates demo/dev routes).
3. Demo data still in Neon: demo admins `admin@swiftship.com`/`ops@swiftship.com` (dev seeding), demo/example members and rows — purge before commercial go-live (briefed as "remove test records").
4. No helmet/security headers; no webhook endpoints yet (n/a until providers).
5. In-memory idempotency map (per-process) — fine for single instance; multi-instance needs a DB-backed store (hardening).
6. Photo file serving: extension/mime validated at upload; filenames are random UUIDs; owner/admin access enforced; stored on local disk (S3 abstraction later for scale).
7. Standalone scripts must not write `db.json` while the API runs (this caused a demo-data wipe during development — sync push is now merge-safe so it cannot recur).

## 11. Exact Phase-1 files
Backend:
- `backend/src/lib/commerce.js` (state machines, actions, audit, idempotency, seeds, rules)
- `backend/src/routes/commerce.routes.js` (member + admin commerce API)
- `backend/src/lib/remoteStore.js` (merge-safe Neon sync, `removeDocs`)
- `backend/src/app.js` (mounts, CORS incl. Idempotency-Key, upload error mapping)
- `backend/src/server.js` (boot seeds/migration ordering)
- `backend/src/lib/db.js` (collections defaults)
Frontend (member):
- `frontend/src/lib/portalApi.js`, `frontend/src/pages/account/PackagesPage.jsx`, `PackagePreAlertPage.jsx`, `PackageDetailPage.jsx`, `MailboxesPage.jsx`, edits: `Overview.jsx`, `components/portal/PortalShell.jsx`, `App.jsx`
Dashboard (admin):
- `dashboard/src/pages/Warehouses.jsx`, `Receiving.jsx`, `WarehousePackages.jsx`, edits: `App.jsx`, `components/AppSidebar.jsx`

## 12. Build/test results
Updated continuously — see final chat report. Chain verified by curl: pre-alert → receive (idempotent, no twins) → assign → measurements → photos → member ship action → staff transitions (invalid rejected 409) → quote → audit rows; authorization (member 403 on admin, anon 401 on everything incl. files); upload validation (400/413).

Final status (this session):
- Backend: `node --check` clean on all touched files; server boots healthy; Neon mirror merge-sync verified (users 7 / members 29 / parcels 200 / warehouses 7 / packages 4 / carriers 6 / pricingRules 7 / quotes 2 / auditLogs 8 / applications 4).
- Member frontend production build: `npm run build` → exit 0 (chunk-size warning only).
- Admin dashboard production build: `npm run build` → exit 0 (chunk-size warning only).
- i18n parity: 342 keys × 5 languages, all checks pass (no new keys added — portal pages are English by existing convention).
- Advisory package actions now return "Request sent to the warehouse team." (no more "moved to null").
- Live browser rendering not exercised in this session (no browser runtime available); all pages were verified by contract review + JSX parse + production build.

