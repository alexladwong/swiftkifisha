# First-deployment guide — SwiftKifisha Global

Everything needed to ship the three surfaces: **member site** (`frontend/`),
**admin dashboard** (`dashboard/`) and the **API** (Express + Neon Postgres,
with Convex as a live optional backend). Status of the current codebase is
documented at the end of this file.

## Architecture

```
member site (frontend/dist)  ─┐
                              ├── /api ──► Express API (:5001, Neon Postgres)
admin dashboard (dashboard/dist) ─┘          (or https://precise-pig-300.convex.site/api)
```

- Both frontends call `{origin}/api/*` (default `VITE_API_BASE_URL=/api`).
  The deploy host must **proxy `/api` to the API origin** — see below.
- Auth is Bearer-JWT based (localStorage `token`/`user`, mirrored into Redux).
- Admin login is **passwordless email + OTP** (`/api/auth/admin/otp/*`); Google
  social sign-in is available for members (`/api/auth/sign-in/social`).
- Transactional email (password reset, OTP codes) is delivered over **Hostinger
  SMTP** by the Express backend.

## 1. Secrets (never commit these)

Real values live only in the **gitignored** files:
`backend/.env`, `convex-backend/.env.local` (and the API host's env store).
The tracked `*.env.example` files are placeholders by design.

| Variable | Where | Used for |
|---|---|---|
| `DATABASE_URL` | backend/.env | Neon Postgres (auto-sync persistence) |
| `JWT_SECRET` | backend/.env | Admin/session JWT signing (rotate!) |
| `SENDINBLUE_API_KEY` | backend/.env | Brevo transactional email (optional; Hostinger SMTP is primary) |
| `EMAIL_HOST*`, `EMAIL_FROM` | backend/.env | Hostinger SMTP (password reset + OTP) |
| `AUTH_GOOGLE_ID/SECRET` | backend/.env | Express Google sign-in |
| `BETTER_AUTH_GOOGLE_ID/SECRET` | convex env | Convex Google sign-in |
| `BETTER_AUTH_SECRET`, `SITE_URL`, `CROSS_SITE_AUTH` | convex env | Convex deployment |

Generate fresh secrets for production:

```sh
openssl rand -base64 48          # JWT_SECRET / BETTER_AUTH_SECRET
openssl rand -hex 32
```

## 2. Backend (Express + Neon)

```sh
cd backend
npm ci
cp .env.example .env        # then fill in DATABASE_URL, SMTP, Google creds
npm run dev                 # development
NODE_ENV=production node src/server.js   # production (or pm2/systemd)
```

- Health check: `GET /api/health`
- Demo admins are seeded on an empty store (`admin@swiftship.com / Admin@123`,
  `ops@swiftship.com / Ops@123`); reseed with `npm run seed`.
- The API auto-syncs every write to Neon Postgres when `DATABASE_URL` is set.

## 3. Optional backend (Convex — already deployed)

```sh
cd convex-backend
npx convex login
npx convex deploy                        # or CONVEX_DEPLOYMENT=prod:precise-pig-300 npx convex deploy
npx convex env set BETTER_AUTH_SECRET <secret>
npx convex env set SITE_URL <your site origin>
npx convex env set BETTER_AUTH_GOOGLE_ID <client id>
npx convex env set BETTER_AUTH_GOOGLE_SECRET <client secret>
# only if frontends call the Convex origin directly cross-site:
npx convex env set CROSS_SITE_AUTH true
```

Dataset sync from Express/Neon to Convex (one-shot):

```sh
cd convex-backend
CONVEX_DEPLOYMENT=prod:precise-pig-300 node scripts/import-express-data.mjs
```

## 4. Google OAuth redirect URIs (per client)

Add **all** of these to the Google OAuth client you deploy with:

```
https://<your-api-origin>/api/auth/callback/google     (Express behind your domain)
https://<your-api-origin>/api/auth/callback/google     (Convex: https://precise-pig-300.convex.site/...)
http://localhost:5173/api/auth/callback/google         (dev, member site)
http://localhost:5174/api/auth/callback/google         (dev, dashboard)
```

## 5. Frontends (static builds)

```sh
cd frontend && npm ci && npm run build        # → frontend/dist
cd dashboard && npm ci && npm run build      # → dashboard/dist
```

Optional per-target env (in `.env.production` or your host's env):

```
VITE_API_BASE_URL=/api                          # default; same-origin proxy
# or point straight at a backend:
# VITE_API_BASE_URL=https://your-api.com/api
```

### Proxying `/api` (required unless `VITE_API_BASE_URL` is absolute)

Nginx example:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:5001;   # Express, or an upstream to Convex
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Vercel (`vercel.json` rewrite): `{ "source": "/api/:path*", "destination": "https://your-api.com/api/:path*" }` — same idea on Netlify via `_redirects`: `/api/* https://your-api.com/api/:splat 200`.

## 6. First-deployment checklist

- [ ] `backend/.env` has real `DATABASE_URL`, fresh `JWT_SECRET`, SMTP creds; `NODE_ENV=production` on the host.
- [ ] `npm run build` passes in both apps and `.env.example` files contain **no** real secrets (verified by `grep`).
- [ ] Google OAuth client lists all redirect URIs from §4 (new client, not the old one).
- [ ] Admin accounts exist (`Add Admin` page, or `info@ladwongdevelopers.dev` OTP access on the API store you run).
- [ ] API reachable through the host proxy: `curl https://your-site/api/health`.
- [ ] Optional: `npx convex deploy` matches this repo's `convex-backend/` and its env vars are set (§3).
- [ ] Smoke: member sign-up/in → `/account`; admin OTP login → dashboard; create a parcel → track it; forgot-password email arrives.
- [ ] Run `node scripts/check-i18n.cjs` after any copy changes (5 languages, key parity).
- [ ] `npm run test` in both apps (vitest placeholder suites).

## Current state (verified in this pass)

- API contract tests: **23/23 pass** against Express/Neon and the live Convex deployment (health, login + 401 path, stats/members/parcels/analytics/shop, tracking, quotes intl + domestic, forgot, OTP, Google providers/start 302, CORS preflight, auth guards).
- Both frontends: **production builds green** (`frontend/dist`, `dashboard/dist`).
- i18n: 342 keys × 5 languages, parity audit green.
- Known demo-only notes: `RESET_LINK_DEBUG=true` is set on the Convex env (dev-code display) — unset once a valid email provider key exists. Seeded demo accounts exist on a fresh Express store.
