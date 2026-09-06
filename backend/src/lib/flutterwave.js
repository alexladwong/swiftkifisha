/**
 * Flutterwave (v3) service — backend only, test/production by env.
 *
 * - Payment links (standard redirect): the member is sent to Flutterwave's
 *   hosted page; success is NEVER trusted from the browser — the backend
 *   verifies the transaction with the secret key before crediting anything.
 * - Webhooks: intake endpoint verifies server-side too.
 * - No simulated success; secrets never logged.
 */

const BASE = "https://api.flutterwave.com/v3";

const cfg = () => ({
  secret: process.env.FLW_SECRET_KEY || "",
  public: process.env.FLW_PUBLIC_KEY || "",
  encryption: process.env.FLW_ENCRYPTION_KEY || "",
  env: String(process.env.FLW_ENV || "test").toLowerCase(),
});

export function flutterwaveConfigured() {
  const c = cfg();
  return Boolean(c.secret && c.public);
}

async function flw(path, { method = "GET", body } = {}) {
  const c = cfg();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${c.secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === "error") {
    const msg = String(data.message || `HTTP ${res.status}`).replace(/[^ -~]/g, "").slice(0, 220);
    throw new Error(`Flutterwave ${path} failed (${res.status}) — ${msg}`);
  }
  return data;
}

/** Connectivity check (no charge): reads the USD balance with the secret. */
export async function flutterwaveTestConnection() {
  const started = Date.now();
  try {
    const data = await flw("/balances/USD");
    return { ok: true, latencyMs: Date.now() - started, env: cfg().env, balance: data?.data?.available_balance ?? null };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, env: cfg().env, message: err?.message || "Connection failed." };
  }
}

/**
 * Creates a standard payment (redirect to Flutterwave hosted page).
 * Amount + currency come from the stored payment record only.
 */
export async function createFlutterwavePayment({ amount, currency, email, txRef, redirectUrl, narration }) {
  if (!flutterwaveConfigured()) throw new Error("Flutterwave is not fully configured.");
  const data = await flw("/payments", {
    method: "POST",
    body: {
      tx_ref: String(txRef).slice(0, 40),
      amount: String(amount),
      currency: String(currency || "USD").toUpperCase(),
      redirect_url: String(redirectUrl).slice(0, 500),
      customer: { email: String(email).slice(0, 120) },
      customizations: {
        title: "SwiftKifisha",
        description: String(narration || "SwiftKifisha payment").slice(0, 100),
      },
      meta: { paymentId: String(txRef) },
    },
  });
  const link = data?.data?.link || null;
  const flwId = data?.data?.id ?? null;
  if (!link) throw new Error("Flutterwave did not return a payment link.");
  return { link, flwId, txRef: data?.data?.tx_ref || txRef };
}

/**
 * Server-side verification of a transaction (by our tx_ref or Flutterwave id).
 * Only `status === "successful"` (with amount/currency match) counts.
 */
export async function verifyFlutterwaveTransaction({ flwId, txRef }) {
  const path = flwId ? `/transactions/${flwId}/verify` : `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
  const data = await flw(path);
  const tx = data?.data || {};
  return {
    status: tx.status || "unknown",
    id: tx.id ?? null,
    txRef: tx.tx_ref || txRef,
    amount: tx.amount != null ? Number(tx.amount) : null,
    currency: tx.currency || null,
    receipt: String(tx.id ?? "") || null,
    raw: { status: tx.status, id: tx.id, tx_ref: tx.tx_ref, amount: tx.amount, currency: tx.currency, created_at: tx.created_at },
  };
}
