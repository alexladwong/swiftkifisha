import { config } from "./config.js";
import app from "./app.js";
import { seedIfEmpty } from "./lib/seed.js";

async function main() {
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
