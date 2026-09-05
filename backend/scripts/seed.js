/**
 * Wipes the local JSON database and regenerates the demo dataset.
 * Usage: npm run seed
 */
import { config } from "../src/config.js";
import { buildDemoData } from "../src/lib/seed.js";
import { db } from "../src/lib/db.js";

const { users, members, parcels } = await buildDemoData();
db.data = { users, members, parcels };
db.persist();
console.log(`Seeded ${users.length} admins, ${members.length} members and ${parcels.length} parcels into ${config.dataFile}`);
console.log("Demo logins:");
for (const u of users) console.log(`  ${u.email} / ${u.role}`);
