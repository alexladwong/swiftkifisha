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
    requiredEnv: ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY"],
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
  const pending = code === "CARD"
    ? "Visa/Mastercard payments — coming soon (provided by the bank)."
    : "Integration prepared — provider credentials required.";
  return {
    code,
    label: p.label,
    integration: "api",
    configured,
    message: configured
      ? "Provider credentials detected — adapter handshake required before live charges."
      : pending,
  };
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

export const hashEvent = (providerCode, rawBody) =>
  crypto.createHash("sha256").update(providerCode + ":" + String(rawBody)).digest("hex");
