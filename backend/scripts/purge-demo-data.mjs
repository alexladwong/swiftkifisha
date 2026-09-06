/**
 * Demo/test-data purger — commercial go-live hygiene.
 *
 * Removes rows that are visibly test/demo data from the persisted dataset
 * (db.json) AND from the Neon mirror (SwiftKifisha_sync), so the commercial
 * dashboards never show sample customers.
 *
 * Matched by explicit rule, never by guesswork:
 *   - emails ending in "@example.com"  (all demo members/applications/messages/quotes)
 *   - users named "Local Dev Admin"/"SwiftKifisha Global Admin"/"Operations Team"
 *     or emails "dev.local@…", "admin@swiftship.com", "ops@swiftship.com" ONLY
 *     with --admins (demo credentials must not ship in production).
 *   - packages/quotes created by those emails (customerEmail on package/quote rows)
 *   - membership applications with those emails
 *   - messages/announcements whose content mentions the demo contacts are left
 *     untouched unless their email matches.
 *
 * Usage (from backend/):
 *   node scripts/purge-demo-data.mjs            # dry run — prints what WOULD be removed
 *   node scripts/purge-demo-data.mjs --yes      # perform removal (file + Neon)
 *   node scripts/purge-demo-data.mjs --yes --admins   # also remove demo admin logins
 *
 * SAFETY:
 *   - Never targets real addresses (e.g. gmail.com, ladwongdevelopers.dev).
 *   - Run while the API server is STOPPED (single writer rule), then start it
 *     again — boot pulls Neon, which no longer contains the purged rows.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataFile = path.join(root, "data", "db.json");
const envFile = path.join(root, ".env");

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const admins = args.includes("--admins");

const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim() || process.env.DATABASE_URL;

const demoEmail = (e) => String(e || "").toLowerCase().endsWith("@example.com");
const demoAdminEmail = (e) =>
  ["admin@swiftship.com", "ops@swiftship.com", "dev.local@ladwongdevelopers.dev"].includes(String(e || "").toLowerCase());

if (!fs.existsSync(dataFile)) {
  console.error("db.json not found at", dataFile);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

const removed = { users: 0, members: 0, applications: 0, packages: 0, quotes: 0, messages: 0, announcements: 0 };
const dropIds = { users: [], members: [], applications: [], packages: [], quotes: [], messages: [], announcements: [] };
const targetEmail = (e) => demoEmail(e) || (admins && demoAdminEmail(e));

data.users ||= [];
data.members ||= [];
for (const u of data.users) {
  if (targetEmail(u.email)) { dropIds.users.push(u._id); }
}
for (const m of data.members) {
  if (targetEmail(m.email)) { dropIds.members.push(m._id); }
}
const userEmails = new Set(dropIds.users.map((id) => data.users.find((u) => u._id === id)?.email));
const memberEmails = new Set(dropIds.members.map((id) => data.members.find((m) => m._id === id)?.email));
const goneEmails = new Set([...userEmails, ...memberEmails].filter(Boolean));

for (const a of data.applications || []) if (goneEmails.has(a.email)) dropIds.applications.push(a._id);
for (const p of data.packages || []) if (goneEmails.has(p.customerEmail)) dropIds.packages.push(p._id);
for (const q of data.quotes || []) if (goneEmails.has(q.customerEmail)) dropIds.quotes.push(q._id);
for (const m of data.messages || []) if (goneEmails.has(m.email)) dropIds.messages.push(m._id);
// Announcements are global (no email) — nothing to purge automatically.

for (const [coll, ids] of Object.entries(dropIds)) {
  const before = (data[coll] || []).length;
  data[coll] = (data[coll] || []).filter((d) => !ids.includes(d._id));
  removed[coll] = before - data[coll].length;
}

console.log("Dry-run? ", !yes, "| include demo admins? ", admins);
for (const [k, v] of Object.entries(removed)) if (v) console.log(`  would remove ${v} ${k}`);
const total = Object.values(removed).reduce((a, b) => a + b, 0);
if (!total) { console.log("Nothing to purge."); process.exit(0); }

if (!yes) { console.log("Re-run with --yes to apply."); process.exit(0); }

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");
console.log(`db.json updated (removed ${total} row(s)).`);

if (dbUrl) {
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  for (const [coll, ids] of Object.entries(dropIds)) {
    if (!ids.length) continue;
    for (const id of ids) {
      await pool.query("DELETE FROM SwiftKifisha_sync WHERE collection = $1 AND id = $2", [coll, String(id)]);
    }
  }
  await pool.end();
  console.log("Neon mirror purged for the same ids.");
} else {
  console.warn("No DATABASE_URL — Neon mirror NOT purged.");
}
