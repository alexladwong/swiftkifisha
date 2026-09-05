import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import parcelRoutes from "./routes/parcels.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Tiny request log for development.
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "swiftship-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/parcels", parcelRoutes);
app.use("/api/dashboard", statsRoutes);
app.use("/api/analytics", analyticsRoutes);

// Unknown API routes.
app.use("/api", (_req, res) => res.status(404).json({ message: "API route not found." }));

// Central error handler.
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }
  return res.status(500).json({ message: "Internal server error." });
});

export default app;
