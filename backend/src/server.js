import { config } from "./config.js";
import app from "./app.js";
import { seedIfEmpty } from "./lib/seed.js";
import { ensureEnabled, pull, push, ensureSchema } from "./lib/remoteStore.js";
import { db } from "./lib/db.js";

async function syncFromRemote() {
  if (!(await ensureEnabled())) return;
  try {
    const remote = await pull();
    if (remote) {
      db.data = remote;
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

  const server = app.listen(config.port, config.host, () => {
    console.log("");
    console.log("  SwiftShip API listening:");
    console.log(`    http://localhost:${config.port}/api/health`);
    console.log("");
    console.log("  Frontends proxy /api here (see frontend & dashboard vite.config.js).");
    console.log("  Demo admin logins (seeded on first start):");
    console.log("    admin@swiftship.com / Admin@123");
    console.log("    ops@swiftship.com   / Ops@123");
    console.log("  Reset demo data anytime with:  npm run seed");
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