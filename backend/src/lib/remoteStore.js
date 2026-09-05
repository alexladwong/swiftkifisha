import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;
let pool = null;
let enabled = false;

export function remoteEnabled() {
  return enabled;
}

export function getPool() {
  return pool;
}

/** One-off connectivity check (used by scripts and boot logs). */
export async function ping() {
  const p = await connectPool();
  await p.query("SELECT 1");
  return p;
}

async function connectPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL || config.databaseUrl;
  if (!url) return null;
  // node-postgres understands sslmode=require; unknown query params are ignored.
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  pool.on("error", (err) => console.error("[remote] idle client error:", err.message));
  return pool;
}

/**
 * Ensures the sync table exists:
 * SwiftKifisha_sync(collection text, id text, doc jsonb, updated_at timestamptz)
 */
export async function ensureSchema(p = null) {
  const client = p || (await connectPool());
  if (!client) return false;
  await client.query(`
    CREATE TABLE IF NOT EXISTS SwiftKifisha_sync (
      collection text NOT NULL,
      id text NOT NULL,
      doc jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    )
  `);
  return true;
}

/** Load the full dataset from Postgres (null when nothing stored yet). */
export async function pull(p = null) {
  const client = p || (await connectPool());
  if (!client) return null;
  const res = await client.query("SELECT collection, doc FROM SwiftKifisha_sync");
  if (res.rows.length === 0) return null;
  const out = { users: [], members: [], parcels: [] };
  for (const row of res.rows) {
    if (Array.isArray(out[row.collection])) out[row.collection].push(row.doc);
  }
  return out;
}

/**
 * Pushes the full dataset to Postgres inside one transaction (replace-style
 * upsert). Datasets are small (hundreds of rows) and writes are rare.
 */
export async function push(data, p = null) {
  const client = p || (await connectPool());
  if (!client) return false;
  const tx = await client.connect();
  try {
    await tx.query("BEGIN");
    await tx.query("DELETE FROM SwiftKifisha_sync");
    const params = [];
    const rows = [];
    for (const collection of ["users", "members", "parcels"]) {
      for (const doc of data[collection] || []) {
        params.push(collection, String(doc._id), JSON.stringify(doc));
        rows.push("($" + (params.length - 2) + "::text, $" + (params.length - 1) + "::text, $" + params.length + "::jsonb)");
      }
    }
    if (rows.length) {
      const sql =
        "INSERT INTO SwiftKifisha_sync (collection, id, doc) VALUES " +
        rows.join(", ") +
        " ON CONFLICT (collection, id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()";
      await tx.query(sql, params);
    }
    await tx.query("COMMIT");
    return true;
  } catch (err) {
    await tx.query("ROLLBACK");
    console.error("[remote] push failed:", err.message);
    return false;
  } finally {
    tx.release();
  }
}

/** Enabled lazy on first use so the API still boots without a DATABASE_URL. */
export async function ensureEnabled() {
  if (enabled) return true;
  const url = process.env.DATABASE_URL || config.databaseUrl;
  if (!url) return false;
  const client = await connectPool();
  try {
    await client.query("SELECT 1");
    await ensureSchema(client);
    enabled = true;
    console.log("[remote] Neon Postgres connected (auto-sync active)");
    return true;
  } catch (err) {
    console.error("[remote] connection failed:", err.message);
    return false;
  }
}