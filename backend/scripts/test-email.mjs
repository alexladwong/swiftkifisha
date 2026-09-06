#!/usr/bin/env node
/**
 * SMTP smoke test: sends one transactional email through the configured
 * provider (Hostinger SMTP primary, Brevo fallback). Never prints secrets.
 *
 *   npm run test:email                 -> sends to DEV_ADMIN_EMAIL or the arg
 *   npm run test:email you@example.com
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, "../.env");
for (const rawLine of fs.readFileSync(envFile, "utf8").split("\n")) {
  const line = rawLine.replace(/\r$/, "").trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  const key = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (process.env[key] === undefined) process.env[key] = value;
}

const { sendPasswordResetEmail } = await import("../src/lib/mailer.js");

const to = process.argv[2] || process.env.DEV_ADMIN_EMAIL || process.env.EMAIL_HOST_USER || "";
if (!to) {
  console.error("No recipient: pass an email argument or set DEV_ADMIN_EMAIL.");
  process.exit(2);
}

const provider = process.env.EMAIL_HOST && process.env.EMAIL_HOST_USER && process.env.EMAIL_HOST_PASSWORD
  ? `Hostinger SMTP (${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT || 465})`
  : process.env.SENDINBLUE_API_KEY
    ? "Brevo API"
    : "NONE";

console.log(`[test:email] provider: ${provider}`);
console.log(`[test:email] from: ${process.env.EMAIL_FROM || "LADSU <sales@ladwongsu.com>"}`);
console.log(`[test:email] to: ${to}`);
if (provider === "NONE") {
  console.error("[test:email] no email provider configured — nothing to test.");
  process.exit(3);
}

const sent = await sendPasswordResetEmail({
  to,
  resetLink: "http://localhost:5173/reset-password?token=email-smoke-test",
});
console.log(sent ? "[test:email] OK — message accepted by the provider." : "[test:email] FAILED");
process.exit(sent ? 0 : 1);
