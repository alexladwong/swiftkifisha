# Courier Management System

Full-stack courier management system ("SwiftShip / SwiftUG") with three apps:

| App         | Folder      | Tech                              | URL (dev)              |
| ----------- | ----------- | --------------------------------- | ---------------------- |
| **API**     | `backend/`    | Node + Express (JSON persistence) | http://localhost:5001  |
| **Website** | `frontend/`  | Vite + React + shadcn/ui (public) | http://localhost:5173  |
| **Admin**   | `dashboard/` | Vite + React + shadcn/ui (admin)  | http://localhost:5174  |

The two web apps proxy every `/api` request to the backend
(`vite.config.js` — override with the `API_PROXY` env var if you move the API).

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
