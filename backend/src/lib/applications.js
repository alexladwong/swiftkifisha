/**
 * Membership applications — stored in db.data.applications so they persist in
 * db.json AND sync to Neon (see remoteStore.SYNC_COLLECTIONS).
 *   { _id, name, email, phone, homeCountry, message,
 *     status: "pending"|"under_review"|"accepted"|"cancelled",
 *     note, reviewedBy, createdAt, updatedAt }
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "./db.js";
import { config } from "../config.js";

// One-time migration from the legacy file store (data/applications.json*)
// into db.data.applications so rows persist and sync to Neon. Called from
// server.js AFTER the remote pull so ordering is deterministic.
const LEGACY_FILE = path.join(config.root, "data", "applications.json");
const LEGACY_MIGRATED = LEGACY_FILE + ".migrated";

export function migrateLegacyApplications() {
  try {
    const source = fs.existsSync(LEGACY_FILE) ? LEGACY_FILE : fs.existsSync(LEGACY_MIGRATED) ? LEGACY_MIGRATED : null;
    if (!source) return;
    const legacy = JSON.parse(fs.readFileSync(source, "utf8"));
    const current = db.data.applications || [];
    if (Array.isArray(legacy) && legacy.length && current.length === 0) {
      db.data.applications = legacy;
      db.persist();
      console.log(`[applications] migrated ${legacy.length} legacy application(s) into the synced store.`);
    }
    try { fs.renameSync(source, LEGACY_MIGRATED); } catch { /* keep as-is */ }
  } catch (e) {
    console.error("[applications] legacy migration skipped:", e.message);
  }
}

export function listApplications(filter) {
  const rows = db.data.applications || [];
  if (!filter || !filter.status) return rows;
  return rows.filter((r) => r.status === filter.status);
}

export function applicationByEmail(email) {
  return (db.data.applications || []).find((r) => r.email === email) || null;
}

export function applicationById(id) {
  return (db.data.applications || []).find((r) => r._id === id) || null;
}

export function createApplication({ name, email, phone, homeCountry, message }) {
  const rows = db.data.applications || [];
  const row = {
    _id: crypto.randomUUID(),
    name,
    email: String(email).toLowerCase().trim(),
    phone: phone || "",
    homeCountry: homeCountry || "",
    message: message || "",
    status: "pending",
    note: "",
    reviewedBy: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.applications = rows;
  db.data.applications.push(row);
  db.persist();
  return row;
}

export function updateApplication(id, patch) {
  const rows = db.data.applications || [];
  const row = rows.find((r) => r._id === id);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  db.data.applications = rows;
  db.persist();
  return row;
}

export function deleteApplication(id) {
  db.data.applications = (db.data.applications || []).filter((r) => r._id !== id);
  db.persist();
}
