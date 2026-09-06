/**
 * M-Pesa (Daraja) service — backend only.
 *
 * Responsibilities:
 *  - OAuth access token with safe caching (token expires ~59 min; cache ~50).
 *  - STK push initiation from the server-computed amount.
 *  - Status query for delayed callbacks.
 *  - Callback payload parsing + provider result mapping.
 *
 * Rules enforced here and by the routes:
 *  - Credentials come from backend env ONLY (never frontend/Vite).
 *  - No simulated success: every payment becomes PAID only after Daraja
 *    returns ResultCode 0 in a callback (verified by CheckoutRequestID +
 *    amount + receipt) or an equivalent server-side status query.
 *  - Secrets are never logged.
 */

const DARAJA_BASES = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

const creds = () => ({
  key: process.env.MPESA_CONSUMER_KEY || "",
  secret: process.env.MPESA_CONSUMER_SECRET || "",
  passkey: process.env.MPESA_PASSKEY || "",
  shortcode: process.env.MPESA_SHORTCODE || "",
  env: String(process.env.MPESA_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox",
  callbackUrl: process.env.MPESA_CALLBACK_URL || "",
  transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
  currency: String(process.env.MPESA_CURRENCY || "KES").toUpperCase(),
});

export function mpesaConfigured() {
  const c = creds();
  return Boolean(c.key && c.secret && c.passkey && c.shortcode);
}

export function mpesaShortcodeSet() {
  return Boolean(creds().shortcode);
}

/* ------------------------------- token cache ------------------------------- */

let _token = null;
let _tokenAt = 0;
const TOKEN_TTL_MS = 50 * 60 * 1000; // Daraja tokens last ~59 min

export async function getAccessToken({ force = false } = {}) {
  const c = creds();
  if (!c.key || !c.secret) throw new Error("M-Pesa consumer key/secret are not configured.");
  if (!force && _token && Date.now() - _tokenAt < TOKEN_TTL_MS) return _token;
  const basic = Buffer.from(`${c.key}:${c.secret}`).toString("base64");
  const res = await fetch(`${DARAJA_BASES[c.env]}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("M-Pesa credentials were rejected (401/403) — check consumer key/secret and environment.");
  }
  if (res.status === 429) throw new Error("M-Pesa rate limit reached — try again shortly.");
  if (res.status >= 500) throw new Error(`M-Pesa provider unavailable (HTTP ${res.status}).`);
  if (!res.ok) throw new Error(`M-Pesa OAuth failed (HTTP ${res.status}).`);
  const body = await res.json();
  if (!body?.access_token) throw new Error("M-Pesa returned no access token.");
  _token = body.access_token;
  _tokenAt = Date.now();
  return _token;
}

/* ------------------------------- MSISDN ------------------------------- */

/** Normalize to Daraja format: 2547XXXXXXXX (Kenya). Accepts 07…, 2547…, +2547…. */
export function normalizeMsisdn(input) {
  const raw = String(input || "").replace(/[^0-9+]/g, "");
  if (/^\+2547\d{8}$/.test(raw)) return raw.slice(1);
  if (/^2547\d{8}$/.test(raw)) return raw;
  if (/^07\d{8}$/.test(raw)) return "254" + raw.slice(1);
  return null;
}

/* ------------------------------- STK push ------------------------------- */

/** Base64 security credential: base64(passkey + timestamp). */
function stkPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

function darajaTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Initiate STK push. `amount` is the server-computed settlement amount in
 * `currency`. Returns raw Daraja fields (no secrets).
 */
export async function initiateStkPush({ phoneNumber, amount, accountReference, transactionDesc = "SwiftKifisha payment" }) {
  const c = creds();
  if (!mpesaConfigured()) {
    throw new Error("M-Pesa is not fully configured (key, secret, passkey and shortcode are required).");
  }
  const msisdn = normalizeMsisdn(phoneNumber);
  if (!msisdn) throw new Error("Enter a valid M-Pesa phone number (e.g. 0712XXXXXX or +2547XXXXXXXX).");
  const amountNum = Math.round(Number(amount) || 0);
  if (!(amountNum > 0)) throw new Error("Invalid payment amount.");
  const timestamp = darajaTimestamp();
  const token = await getAccessToken();
  const payload = {
    BusinessShortCode: c.shortcode,
    Password: stkPassword(c.shortcode, c.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: c.transactionType,
    Amount: amountNum,
    PartyA: msisdn,
    PartyB: c.shortcode,
    PhoneNumber: msisdn,
    CallBackURL: c.callbackUrl,
    AccountReference: String(accountReference || "SwiftKifisha").slice(0, 12),
    TransactionDesc: String(transactionDesc).slice(0, 13),
  };
  const res = await fetch(`${DARAJA_BASES[c.env]}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401 || res.status === 403) {
    // Token may have rotated/invalidated — clear cache once and retry.
    _token = null;
    throw new Error("M-Pesa authorization failed on STK push — try again.");
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).replace(/[^ -~]/g, "").slice(0, 240);
    throw new Error(`M-Pesa STK push failed (HTTP ${res.status})${text ? ` — ${text}` : ""}.`);
  }
  const body = await res.json().catch(() => ({}));
  return {
    merchantRequestId: body.MerchantRequestID || null,
    checkoutRequestId: body.CheckoutRequestID || null,
    responseCode: body.ResponseCode ?? null,
    responseDescription: body.ResponseDescription || null,
    customerMessage: body.CustomerMessage || null,
  };
}

/** Query STK status (used for delayed-callback reconciliation / /refresh). */
export async function queryStkStatus({ checkoutRequestId }) {
  const c = creds();
  if (!mpesaConfigured()) throw new Error("M-Pesa is not fully configured.");
  const timestamp = darajaTimestamp();
  const token = await getAccessToken();
  const res = await fetch(`${DARAJA_BASES[c.env]}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: stkPassword(c.shortcode, c.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`M-Pesa status query failed (HTTP ${res.status}).`);
  return res.json();
}

/* ------------------------------- callback parsing ------------------------------- */

/**
 * Maps Daraja STK result codes to our payment lifecycle. Preserves the raw
 * provider code/description for staff diagnostics — never blindly FAILED.
 */
export const MPESA_RESULT_MAP = {
  0: "PAID", // success
  1032: "CANCELLED", // user cancelled on phone
  1031: "FAILED", // wrong PIN / insufficient? (kept with raw code)
  1037: "EXPIRED", // timeout waiting for PIN
  1036: "EXPIRED",
  2001: "FAILED", // initiator not allowed
  1: "FAILED",
};

export function parseStkCallback(raw) {
  const cb = raw?.Body?.stkCallback;
  if (!cb) return null;
  const meta = {};
  for (const item of cb.CallbackMetadata?.Item || []) {
    meta[item.Name] = item.Value;
  }
  return {
    merchantRequestId: cb.MerchantRequestID || null,
    checkoutRequestId: cb.CheckoutRequestID || null,
    resultCode: cb.ResultCode,
    resultDesc: String(cb.ResultDesc || ""),
    receiptNumber: meta.MpesaReceiptNumber || null,
    amount: meta.Amount != null ? Number(meta.Amount) : null,
    phoneNumber: meta.PhoneNumber != null ? String(meta.PhoneNumber) : null,
    transactionDate: meta.TransactionDate || null,
    raw: cb,
  };
}
