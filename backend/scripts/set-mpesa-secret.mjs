#!/usr/bin/env node
/**
 * Safely replace the M-Pesa Consumer Secret in backend/.env.
 *
 * Usage (secret is read from STDIN so it never lands in shell history/logs):
 *   node scripts/set-mpesa-secret.mjs < /path/to/secret.txt
 *   echo -n "REAL_SECRET" | node scripts/set-mpesa-secret.mjs
 *
 * Then re-test: curl -X POST http://localhost:5001/api/admin/providers/mpesa/test-connection
 * (finance token required) or click "Test connection" in Payments.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const secret = Buffer.concat(chunks).toString("utf8").trim();

if (!secret) {
  console.error("No input received — pipe or redirect the secret value into stdin.");
  process.exit(1);
}

let env = fs.readFileSync(envFile, "utf8");
const line = 'MPESA_CONSUMER_SECRET="' + secret.replace(/"/g, '\\"') + '"';
if (/^MPESA_CONSUMER_SECRET=/m.test(env)) {
  env = env.replace(/^MPESA_CONSUMER_SECRET=.*$/m, line);
} else {
  env += "\n" + line + "\n";
}
fs.writeFileSync(envFile, env);

const looksEncrypted = /^[A-Za-z0-9+/=]{100,}$/.test(secret);
console.log(`Stored MPESA_CONSUMER_SECRET (length ${secret.length}).`);
console.log(looksEncrypted
  ? "Heads-up: this still looks like an encrypted/very long value. Classic Daraja consumer secrets are short (~40-60 chars) plain text."
  : "Looks like a classic short secret — good. Re-run the connectivity test now.");
console.log("Never paste secrets into chat or commits.");
