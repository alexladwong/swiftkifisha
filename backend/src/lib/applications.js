/**
 * Membership applications store.
 *
 * Kept in its own JSON file (backend/data/applications.json) instead of the
 * synced db.json so applications survive remote Neon pulls (which replace the
 * four synced collections). Structure:
 *   { _id, name, email, phone, homeCountry, message,
 *     status: "pending"|"under_review"|"accepted"|"cancelled",
 *     note, reviewedBy, createdAt, updatedAt }
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

const FILE = path.join(config.root, "data", "applications.json");

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listApplications(filter) {
  const rows = load();
  if (!filter || !filter.status) return rows;
  return rows.filter((r) => r.status === filter.status);
}

export function applicationByEmail(email) {
  return load().find((r) => r.email === email) || null;
}

export function applicationById(id) {
  return load().find((r) => r._id === id) || null;
}

export function createApplication({ name, email, phone, homeCountry, message }) {
  const rows = load();
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
  rows.push(row);
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
  return row;
}

export function updateApplication(id, patch) {
  const rows = load();
  const row = rows.find((r) => r._id === id);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
  return row;
}

export function deleteApplication(id) {
  const rows = load().filter((r) => r._id !== id);
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}
