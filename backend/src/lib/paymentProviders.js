/**
 * Payment provider registry + adapter surface.
 *
 * Every external channel (MTN MoMo, Airtel Money, MPesa, card) is declared
 * here with a uniform adapter contract:
 *
 *   describe()            → readiness for the UI
 *   createCharge(payment) → starts a real provider charge (throws when the
 *                           provider is not configured — never fakes success)
 *   verifyWebhook(event)  → signature-verified event handling
 *
 * Credentials come ONLY from the process env (UPLOAD/… pattern); they are
 * never stored in the dataset and never returned by any endpoint. A channel
 * is "live" only when its required env vars exist AND finance enabled it in
 * paymentConfig. Until then every surface answers:
 *     Integration prepared — provider credentials required.
 */
import crypto from "node:crypto";

export const PROVIDERS = [
  {
    code: "MTN_MOMO",
    label: "MTN Mobile Money (Uganda)",
    requiredEnv: ["MTN_MOMO_PRIMARY_KEY", "MTN_MOMO_API_USER", "MTN_MOMO_API_SECRET"],
  },
  {
    code: "AIRTEL_MONEY",
    label: "Airtel Money (Uganda)",
    requiredEnv: ["AIRTEL_MONEY_CLIENT_ID", "AIRTEL_MONEY_CLIENT_SECRET"],
  },
  {
    code: "MPESA",
    label: "M-Pesa (Daraja API)",
    requiredEnv: ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY", "MPESA_SHORTCODE"],
    optionalEnv: ["MPESA_ENV", "MPESA_CALLBACK_URL", "MPESA_TRANSACTION_TYPE", "MPESA_CURRENCY"],
  },
  {
    code: "CARD",
    label: "Credit / debit card",
    requiredEnv: ["STRIPE_SECRET_KEY"],
  },
];

export const PROVIDER_BY_CODE = Object.fromEntries(PROVIDERS.map((p) => [p.code, p]));

/** True when every credential for the provider exists in env. */
export function providerConfigured(code) {
  const p = PROVIDER_BY_CODE[code];
  if (!p) return false;
  return p.requiredEnv.every((k) => Boolean(process.env[k]));
}

/** Readiness payload for UI/admin — never includes secrets. */
export function describeProvider(code) {
  const p = PROVIDER_BY_CODE[code];
  if (!p) return null;
  const configured = providerConfigured(code);
  const present = p.requiredEnv.filter((k) => Boolean(process.env[k]));
  const missing = p.requiredEnv.filter((k) => !present.includes(k));
  let message;
  if (configured) {
    if (code === "MPESA" && !process.env.MPESA_SHORTCODE) {
      message = "M-Pesa credentials stored — add MPESA_SHORTCODE (paybill/till) and confirm the Consumer Secret in the Safaricom portal (OAuth test currently returns 400).";
    } else if (code === "MPESA") {
      message = `M-Pesa — Connected. Environment: ${process.env.MPESA_ENV === "production" ? "Production" : "Sandbox"}.`;
    } else {
      message = "Provider credentials detected — live adapter handshake required before charges (no simulated success).";
    }
  } else if (code === "CARD") {
    message = "Visa/Mastercard payments — coming soon (provided by the bank).";
  } else if (code === "MPESA" && present.length > 0) {
    message = `M-Pesa credentials partly received — still required: ${missing.join(", ")}.`;
  } else {
    message = "Integration prepared — provider credentials required.";
  }
  const mpesaMeta = code === "MPESA"
    ? {
        env: process.env.MPESA_ENV === "production" ? "Production" : "Sandbox",
        shortcodeMasked: process.env.MPESA_SHORTCODE
          ? "•".repeat(Math.max(2, String(process.env.MPESA_SHORTCODE).length - 2)) + String(process.env.MPESA_SHORTCODE).slice(-2)
          : "",
        callbackConfigured: Boolean(process.env.MPESA_CALLBACK_URL),
      }
    : null;
  return {
    code, label: p.label, integration: "api", configured,
    present: present.length, missing,
    initiable: providerCanInitiate(code),
    env: code === "MPESA" ? process.env.MPESA_ENV || "sandbox" : null,
    ...(mpesaMeta || {}),
    message,
  };
}

/**
 * A provider is "initiable" only when a real charge can actually be pushed:
 * - M-Pesa: consumer key+secret+passkey AND a paybill/till (MPESA_SHORTCODE).
 * - Others: adapters are not implemented yet — never claim initiation.
 */
export function providerCanInitiate(code) {
  if (code === "MPESA") {
    return Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_PASSKEY && process.env.MPESA_SHORTCODE);
  }
  return false; // MTN/Airtel/card adapters pending — never initiate
}

export function describeAllProviders() {
  return PROVIDERS.map((p) => describeProvider(p.code));
}

export class ProviderNotConfiguredError extends Error {
  constructor(code) {
    super("Integration prepared — provider credentials required.");
    this.code = code;
    this.statusCode = 503;
  }
}

/**
 * Starts a provider charge. Real implementations plug in per provider SDK
 * once credentials exist; today every configured path still returns
 * NOT_IMPLEMENTED rather than pretending a charge succeeded.
 */
export async function createProviderCharge({ providerCode, payment }) {
  const p = PROVIDER_BY_CODE[providerCode];
  if (!p) throw new ProviderNotConfiguredError(providerCode);
  if (!providerConfigured(providerCode)) throw new ProviderNotConfiguredError(providerCode);
  // Adapter body lands here with real credentials (Phase 2/3 hardening). We
  // never simulate a successful provider charge.
  throw new Error(`${p.label}: adapter pending — no charge was attempted.`);
}

/** Idempotency key derived from our payment id (stable across retries). */
export function providerIdempotencyKey(payment) {
  return `swk-${payment._id}`;
}

/**
 * Webhook signature verification (prepared). Returns the verified event or
 * throws. Implementations verify provider-specific schemes (MTN base64 auth,
 * Airtel signature, MPesa security credential, Stripe signature).
 */
export async function verifyProviderWebhook(providerCode, rawBody, headers) {
  const p = PROVIDER_BY_CODE[providerCode];
  if (!p) throw new ProviderNotConfiguredError(providerCode);
  if (!providerConfigured(providerCode)) throw new ProviderNotConfiguredError(providerCode);
  // Signature verification is provider-specific; never accept unverified data.
  throw new Error(`${p.label}: webhook signature verification not implemented — events are ignored.`);
}

/* ------------------------------- Daraja (M-Pesa) client ------------------------------- */

const DARAJA_BASES = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

export function darajaEnv() {
  return String(process.env.MPESA_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
}

export function darajaBase() {
  return DARAJA_BASES[darajaEnv()];
}

/** OAuth access token (client_credentials). No charges are ever simulated. */
export async function darajaAccessToken(env = darajaEnv()) {
  const base = DARAJA_BASES[env] || DARAJA_BASES.sandbox;
  const key = process.env.MPESA_CONSUMER_KEY || "";
  const secret = process.env.MPESA_CONSUMER_SECRET || "";
  if (!key || !secret) throw new Error("M-Pesa consumer key/secret are not configured.");
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    throw new Error(`Daraja OAuth failed (${env}): HTTP ${res.status} — check consumer key/secret and MPESA_ENV.`);
  }
  const body = await res.json();
  if (!body?.access_token) throw new Error(`Daraja OAuth returned no token (${env}).`);
  return body.access_token;
}

/** Finance-only connectivity test — never performs charges. Returns the exact
 * HTTP outcome per environment (safe data only, no credentials). */
export async function testDarajaConnection() {
  const results = [];
  for (const env of ["production", "sandbox"]) {
    const started = Date.now();
    let outcome = { env, ok: false, latencyMs: 0, httpStatus: null, reason: "connection failed" };
    try {
      const base = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
      const key = process.env.MPESA_CONSUMER_KEY || "";
      const secret = process.env.MPESA_CONSUMER_SECRET || "";
      const basic = Buffer.from(`${key}:${secret}`).toString("base64");
      const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${basic}` },
        signal: AbortSignal.timeout(12000),
      });
      outcome.latencyMs = Date.now() - started;
      outcome.httpStatus = res.status;
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.access_token) {
          outcome.ok = true;
          outcome.reason = "token issued";
          outcome.tokenPrefix = String(body.access_token).slice(0, 6) + "…";
        } else {
          outcome.reason = "no token in response";
        }
      } else {
        const text = await res.text().catch(() => "");
        const safe = String(text).replace(/[^ -~]/g, "").slice(0, 220);
        outcome.reason = safe || `HTTP ${res.status}`;
      }
    } catch (err) {
      outcome.latencyMs = Date.now() - started;
      outcome.reason = String(err?.message || "connection failed").slice(0, 220);
    }
    results.push(outcome);
  }
  return {
    results,
    configured: Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_PASSKEY),
    shortcode: Boolean(process.env.MPESA_SHORTCODE),
    keyPresent: Boolean(process.env.MPESA_CONSUMER_KEY),
    secretLength: process.env.MPESA_CONSUMER_SECRET ? String(process.env.MPESA_CONSUMER_SECRET).length : 0,
    secretLooksEncrypted: /^[A-Za-z0-9+/=]{100,}$/.test(process.env.MPESA_CONSUMER_SECRET || ""),
    env: String(process.env.MPESA_ENV || "sandbox"),
  };
}

export const hashEvent = (providerCode, rawBody) =>
  crypto.createHash("sha256").update(providerCode + ":" + String(rawBody)).digest("hex");
