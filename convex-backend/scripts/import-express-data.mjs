#!/usr/bin/env node
/**
 * One-time import of the Express/Neon dataset (backend/data/db.json) into the
 * Convex deployment: members first (returns email->newId), then parcels in
 * batches with memberId remapped. Run from convex-backend/ with the target
 * deployment selected, e.g.:
 *
 *   CONVEX_DEPLOYMENT=prod:precise-pig-300 node scripts/import-express-data.mjs
 *
 * Requires: local Express data file + authenticated Convex CLI.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(here, "../../backend/data/db.json");
const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

function run(fn, arg) {
  const json = arg === undefined ? "" : " " + JSON.stringify(arg);
  const out = execSync(`npx convex run ${fn}${json}`, {
    cwd: path.resolve(here, ".."),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out;
}

function parseReturn(output) {
  // convex run prints the returned value as JSON somewhere in stdout.
  const candidates = [...output.matchAll(/\{[\s\S]*\}|\[[\s\S]*\]/g)].map((m) => m[0]);
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(candidates[i]);
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("Could not parse convex run output:\n" + output.slice(-800));
}

const mapMember = (row) => ({
  name: row.name, email: row.email, phone: row.phone, plan: row.plan,
  homeCountry: row.homeCountry, homeCity: row.homeCity, address: row.address,
  memberCode: row.memberCode, joinedAt: row.joinedAt,
  hubAddresses: row.hubAddresses,
});

const mapParcel = (row, idByEmail) => {
  const memberId = row.memberEmail ? (idByEmail[String(row.memberEmail).toLowerCase()] ?? null) : (row.memberId ?? null);
  return {
    trackingId: row.trackingId, senderName: row.senderName, senderPhone: row.senderPhone,
    senderAddress: row.senderAddress, receiverName: row.receiverName, receiverPhone: row.receiverPhone,
    receiverAddress: row.receiverAddress, shipmentType: row.shipmentType, originCity: row.originCity,
    destinationCity: row.destinationCity, originCountry: row.originCountry,
    destinationCountry: row.destinationCountry, deliveryType: row.deliveryType,
    parcelCategory: row.parcelCategory, weight: row.weight, price: row.price, currency: row.currency,
    status: row.status, storeName: row.storeName ?? null, memberId, memberEmail: row.memberEmail ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    checkpoints: (row.checkpoints || []).map((c) => ({
      status: c.status, location: c.location, message: c.message,
      timestamp: c.timestamp ?? c.timestamps ?? "", timestamps: c.timestamps ?? c.timestamp ?? "",
      dateTime: c.dateTime ?? "",
    })),
  };
};

console.log(`Importing ${data.members.length} members and ${data.parcels.length} parcels…`);

const memberOut = run("sync:importMembers", { members: data.members.map(mapMember) });
const idByEmail = parseReturn(memberOut);
console.log("Members imported; email→id map size:", Object.keys(idByEmail).length);

const clearOut = run("sync:clearParcels");
console.log("Parcels cleared:", JSON.stringify(parseReturn(clearOut)));

const parcels = data.parcels.map((p) => mapParcel(p, idByEmail));
const CHUNK = 40;
let insertedTotal = 0;
for (let i = 0; i < parcels.length; i += CHUNK) {
  const chunk = parcels.slice(i, i + CHUNK);
  const out = run("sync:importParcels", { parcels: chunk });
  const res = parseReturn(out);
  insertedTotal += res.inserted ?? 0;
  console.log(`  chunk ${i / CHUNK + 1}: inserted ${res.inserted ?? "?"}`);
}
console.log(`Done — ${insertedTotal} parcels imported.`);
