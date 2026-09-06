import fs from "node:fs";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import parcelRoutes from "./routes/parcels.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import memberRoutes from "./routes/members.routes.js";
import shopRoutes from "./routes/shop.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import commerceRoutes from "./routes/commerce.routes.js";

const app = express();
const LANDING = fs.readFileSync(new URL("./landing.html", import.meta.url), "utf8");

app.disable("x-powered-by");

// Explicit CORS: local dev apps, the Vercel frontends, plus any extra origins
// configured through CORS_ORIGINS (comma separated). Credentials are allowed
// only for these origins — never a wildcard with credentials.
const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://swiftkifisha.vercel.app",
  "https://swiftkifisha-dashboard.vercel.app",
  ...EXTRA_ORIGINS,
];
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (curl, server-to-server) without an Origin.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Idempotency-Key"],
  }),
);
app.use(express.json({ limit: "1mb" }));

// Tiny request log for development.
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

const HEALTH = { status: "ok", service: "swiftship-api", docs: "backend/README.md" };
app.get("/api/health", (_req, res) => res.json(HEALTH));
app.get("/health", (_req, res) => res.json(HEALTH));

// Tiny human landing page so visiting the API in a browser is not a bare 404.
app.get("/", (_req, res) => res.type("html").send(LANDING));

app.use("/api/auth", authRoutes);
app.use("/api/parcels", parcelRoutes);
app.use("/api/dashboard", statsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api", membershipRoutes);
app.use("/api", notificationRoutes);
app.use("/api", commerceRoutes);

// Unknown routes -> always JSON. (Express's built-in HTML error page sets
// Content-Security-Policy: default-src 'none', which breaks Chrome DevTools
// probes like /.well-known/appspecific/com.chrome.devtools.json - never send it.)
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found.",
    hint: req.originalUrl.startsWith("/api")
      ? "See backend/README.md for the API reference."
      : "This is an API server - try /api/health.",
  });
});

// Central error handler.
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large (max 8 MB per file)." });
  }
  if (err?.name === "MulterError") {
    return res.status(400).json({ message: err.message || "Upload rejected." });
  }
  return res.status(500).json({ message: "Internal server error." });
});

export default app;
