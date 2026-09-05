import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tiny .env loader (no dependency): only sets vars that are not already set.
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const rawLine of fs.readFileSync(envFile, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export const config = Object.freeze({
  root,
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 5001),
  jwtSecret: process.env.JWT_SECRET || "swiftship-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  dataFile: process.env.DB_FILE || path.join(root, "data", "db.json"),
  databaseUrl: process.env.DATABASE_URL || "",
  bcryptRounds: 10,
  seedOnStart: (process.env.SEED_ON_START ?? "true") !== "false",
});
