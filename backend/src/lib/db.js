import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { ensureEnabled, push } from "./remoteStore.js";

/**
 * Minimal JSON-file datastore with Mongo-style "_id" values.
 * The whole database is kept in memory and written through atomically on
 * every mutation, so no external database service is required to run the
 * courier management system end to end.
 */
class JsonDb {
  constructor(file) {
    this.file = file;
    this.data = { users: [], members: [], parcels: [], resetTokens: [] };
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return; // fresh database, stays empty
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.data = {
        users: Array.isArray(parsed?.users) ? parsed.users : [],
        members: Array.isArray(parsed?.members) ? parsed.members : [],
        parcels: Array.isArray(parsed?.parcels) ? parsed.parcels : [],
        resetTokens: Array.isArray(parsed?.resetTokens) ? parsed.resetTokens : [],
      };
    } catch (err) {
      console.error("[db] Corrupt database file, starting empty:", err.message);
      this.data = { users: [], members: [], parcels: [], resetTokens: [] };
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic replace
    // Auto-sync: mirror every write to Neon Postgres when DATABASE_URL is set.
    this._remoteChain = (this._remoteChain || Promise.resolve())
      .then(() => ensureEnabled())
      .then((ok) => (ok ? push(this.data) : false))
      .catch((err) => console.error("[remote] sync failed:", err.message));
  }

  isEmpty() {
    return this.data.users.length === 0 && this.data.parcels.length === 0;
  }

  memberById(id) {
    return this.data.members.find((m) => m._id === id) || null;
  }
}

/** 24-char hex id that looks like a MongoDB ObjectId (timestamp + random). */
export function objectId() {
  return (
    Math.floor(Date.now() / 1000).toString(16).padStart(8, "0") +
    crypto.randomBytes(8).toString("hex")
  );
}

const TRACKING_LETTERS = ["CRR", "SWP", "Kifisha", "SPD", "XPR", "FLT", "PKG", "AZM", "NAV", "QKS"];

/** Human friendly unique tracking id, e.g. UG-CRR-482913. */
export function generateTrackingId(existing) {
  const used = new Set((existing || []).map((p) => p.trackingId));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const letters = TRACKING_LETTERS[crypto.randomInt(TRACKING_LETTERS.length)];
    const digits = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const id = `UG-${letters}-${digits}`;
    if (!used.has(id)) return id;
  }
  return `UG-${Date.now().toString().slice(-6)}-${crypto.randomInt(100000, 999999)}`;
}

export function newIdFor(collection) {
  // Parcel ids are referenced in dashboard URLs (/parcel/:id), keep them stable.
  return collection === "users" ? objectId() : objectId();
}

export const db = new JsonDb(config.dataFile);