import { config } from "./config.js";
import app from "./app.js";
import { seedIfEmpty } from "./lib/seed.js";
import { ensureEnabled, pull, push, ensureSchema } from "./lib/remoteStore.js";
import { migrateLegacyApplications } from "./lib/applications.js";
import { seedCommerceDefaults } from "./lib/commerce.js";
import { db } from "./lib/db.js";

async function syncFromRemote() {
  if (!(await ensureEnabled())) return;
  try {
    const remote = await pull();
    if (remote) {
      db.data = {
        users: remote.users || [], members: remote.members || [], parcels: remote.parcels || [],
        resetTokens: remote.resetTokens || [], applications: remote.applications || [],
        messages: remote.messages || [], announcements: remote.announcements || [],
        warehouses: remote.warehouses || [], packages: remote.packages || [],
        pricingRules: remote.pricingRules || [], carriers: remote.carriers || [],
        auditLogs: remote.auditLogs || [], quotes: remote.quotes || [],
      };
      console.log("[remote] loaded " + remote.users.length + " users, " + remote.members.length + " members, " + remote.parcels.length + " parcels from Neon");
    } else if (!db.isEmpty()) {
      await ensureSchema();
      await push(db.data);
      console.log("[remote] pushed local dataset to Neon (initial sync)");
    }
  } catch (err) {
    console.error("[remote] boot sync failed (continuing with local data):", err.message);
  }
}

async function main() {
  await syncFromRemote();
  try {
    await seedIfEmpty();
  } catch (err) {
    console.error("[seed] Demo seeding failed:", err);
  }

  // After the remote pull: fold any legacy-file applications into the synced store.
  migrateLegacyApplications();

  // Seed commercial reference data (warehouses, pricing rules, carrier status)
  // only when missing — admin-managed afterwards.
  seedCommerceDefaults();

  const server = app.listen(config.port, config.host, () => {
    console.log("");
    console.log("  SwiftShip API listening:");
    console.log(`    http://localhost:${config.port}/api/health`);
    console.log("");
    console.log("  Frontends proxy /api here (see frontend & dashboard vite.config.js).");
    if (config.isDev) {
    console.log("  Development demo admins (seeded on first start):");
    console.log("    admin@swiftship.com / Admin@123");
    console.log("    ops@swiftship.com   / Ops@123");
    console.log("  Reset demo data anytime with:  npm run seed");
    if (process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD) {
      console.log("");
      console.log("  DEV-ONLY admin fallback (email OTP unavailable):");
      console.log(`    email:    ${process.env.DEV_ADMIN_EMAIL}`);
      console.log(`    password: ${process.env.DEV_ADMIN_PASSWORD}`);
      console.log("    (route POST /api/auth/admin/dev-login — disabled in production)");
    }
  }
    console.log("");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`
Port ${config.port} is already in use. macOS "AirPlay Receiver" often
occupies port 5000; set PORT=5001 (or another free port) and restart.
`);
      process.exit(1);
    }
    throw err;
  });
}

main();