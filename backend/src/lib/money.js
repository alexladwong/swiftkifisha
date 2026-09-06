/**
 * Commercial money domain (Phase 2): payment status machine, invoice helpers,
 * wallet ledger, shipment (dispatch) machine and settings helpers.
 *
 * HONESTY RULES (enforced by the routes):
 *  - A payment becomes PAID only through a server-side verified action:
 *    finance/admin verification with a reference (offline/bank channels) or a
 *    wallet deduction against a real ledger balance. There is no member-side
 *    "mark as paid" and no simulated provider callback.
 *  - Provider channels (MTN MoMo, Airtel Money, card) exist as registry rows
 *    marked NOT_CONFIGURED until credentials are supplied; the API then answers
 *    "Integration prepared — provider credentials required".
 *  - Every payment/invoice/ledger/shipment mutation writes an audit row.
 */
import crypto from "node:crypto";
import { db } from "./db.js";
import { describeProvider } from "./paymentProviders.js";
import { addAudit } from "./commerce.js";

/* ------------------------------- statuses ------------------------------- */

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAYMENT_SUBMITTED: "PAYMENT_SUBMITTED",
  PAID: "PAID",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
};

// Server-side transitions only (see routes). Staff/wallet flows call these.
// Manual mobile-money lifecycle: PENDING → (member submits transaction
// reference) → PAYMENT_SUBMITTED → (finance verify) → PAID | (reject) → REJECTED.
export const PAYMENT_TRANSITIONS = {
  PENDING: ["PAID", "FAILED", "CANCELLED", "PROCESSING", "PAYMENT_SUBMITTED"],
  PROCESSING: ["PAID", "FAILED", "CANCELLED", "PAYMENT_SUBMITTED"],
  PAYMENT_SUBMITTED: ["PAID", "REJECTED", "FAILED"],
  PAID: ["REFUNDED", "PARTIALLY_REFUNDED"],
  FAILED: ["PENDING"],
  REJECTED: ["PAYMENT_SUBMITTED"],
  CANCELLED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
};

export function canPayTransition(from, to) {
  return Boolean(PAYMENT_TRANSITIONS[from] && PAYMENT_TRANSITIONS[from].includes(to));
}

export const INVOICE_STATUS = {
  ISSUED: "ISSUED",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  VOID: "VOID",
};

export const SHIPMENT_STATUS = {
  CREATED: "CREATED",
  READY_FOR_CARRIER: "READY_FOR_CARRIER",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  CUSTOMS_CLEARANCE: "CUSTOMS_CLEARANCE",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  EXCEPTION: "EXCEPTION",
};

export const SHIPMENT_TRANSITIONS = {
  CREATED: ["READY_FOR_CARRIER", "EXCEPTION"],
  READY_FOR_CARRIER: ["PICKED_UP", "EXCEPTION", "CREATED"],
  PICKED_UP: ["IN_TRANSIT", "CUSTOMS_CLEARANCE", "EXCEPTION"],
  IN_TRANSIT: ["CUSTOMS_CLEARANCE", "OUT_FOR_DELIVERY", "EXCEPTION"],
  CUSTOMS_CLEARANCE: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "EXCEPTION"],
  OUT_FOR_DELIVERY: ["DELIVERED", "EXCEPTION"],
  DELIVERED: [],
  EXCEPTION: ["READY_FOR_CARRIER", "PICKED_UP", "IN_TRANSIT", "CUSTOMS_CLEARANCE", "OUT_FOR_DELIVERY"],
};

export function canShipTransition(from, to) {
  return Boolean(SHIPMENT_TRANSITIONS[from] && SHIPMENT_TRANSITIONS[from].includes(to));
}

// Payment channels. `configured` is driven by admin-managed settings
// (paymentConfig) AND real provider credentials (env) — never hard-coded.
// - Manual channels (OFFLINE bank transfer, MOBILE_MONEY to the receive
//   number) are admin-selectable: finance switches them on/off for members.
// - API provider channels (MTN MoMo, Airtel, MPesa, card) only go live when
//   finance enabled them AND real credentials exist in env.
export const CHANNELS = [
  { code: "MOBILE_MONEY", label: "Mobile money (MTN / Airtel to receive number)", integration: "manual", kind: "momo", topup: true, invoice: true },
  { code: "OFFLINE", label: "Bank transfer / offline (manual verification)", integration: "manual", kind: "offline", topup: true, invoice: true },
  { code: "WALLET", label: "Account credit (wallet)", integration: "internal", topup: false, invoice: true },
  { code: "MTN_MOMO", label: "MTN Mobile Money (Uganda)", integration: "api", provider: "mtn", topup: true, invoice: true },
  { code: "AIRTEL_MONEY", label: "Airtel Money (Uganda)", integration: "api", provider: "airtel", topup: true, invoice: true },
  { code: "MPESA", label: "M-Pesa (Daraja)", integration: "api", provider: "mpesa", topup: true, invoice: true },
  { code: "CARD", label: "Credit / debit card", integration: "api", provider: "stripe", topup: true, invoice: true },
];

/* ------------------------------- mobile-money USSD top-up ------------------------------- */

/**
 * Mobile-money receive account shown on the member top-up QR/USSD flow.
 * Commercial data (receiving number) is admin-editable via paymentConfig.momo
 * and defaults to the operator number provided by the business.
 * ussdTemplate placeholders: {amount} and {number} — the member's phone scans
 * the QR, opens the USSD code and confirms with their MoMo PIN.
 */
export const MOMO_DEFAULT = {
  enabled: true,
  // PRIVATE settlement number — never exposed to members, never embedded in
  // the customer QR/USSD. Admin screens show it masked (+256 75•••••291).
  number: "+256757889291",
  networkLabel: "MTN Mobile Money (Uganda)",
  network: "MTN",
  // Public template: {amount} only. The receive number must NOT appear here.
  ussdTemplate: "*165*1*{amount}#",
};

/** Per-network public templates (Airtel dials *185*1*1*<amount>#). */
export const MOMO_NETWORK_PRESETS = {
  MTN: { label: "MTN Mobile Money (Uganda)", template: "*165*1*{amount}#" },
  AIRTEL: { label: "Airtel Money (Uganda)", template: "*185*1*1*{amount}#" },
};

/** Strips legacy {number} tokens (and a stray preceding '*') from templates. */
export function normalizeUssdTemplate(template) {
  let tpl = String(template || "");
  tpl = tpl.replace(/\*\{number\}/g, "").replace(/\{number\}\*/g, "").replace(/\{number\}/g, "");
  return tpl.replace(/\*+#/g, "#").replace(/\s+/g, "").trim();
}

export function momoTopupConfig() {
  const cfg = getSetting("paymentConfig", null);
  const momo = cfg?.momo || {};
  const merged = { ...MOMO_DEFAULT, ...momo };
  if (String(merged.ussdTemplate || "").includes("{number}")) {
    merged.ussdTemplate = normalizeUssdTemplate(merged.ussdTemplate) || MOMO_DEFAULT.ussdTemplate;
    // One-time migration: rewrite the stored config so legacy values stop
    // re-entering memory on every boot.
    try {
      setSetting("paymentConfig", { ...cfg, momo: { ...momo, ussdTemplate: merged.ussdTemplate } });
    } catch { /* best effort */ }
  }
  return merged;
}

/** Public USSD for one payment amount — server-authoritative amount only. */
export function publicUssd(amount, template) {
  const tpl = String(template || momoTopupConfig().ussdTemplate || "*165*1*{amount}#");
  const safe = tpl.split("{number}").join(""); // never leak the receive number
  const whole = String(Math.round(Number(amount) || 0));
  return safe.split("{amount}").join(whole).replace(/\s+/g, "");
}

/** tel: URI for "Pay on phone" (button-only; never auto-dial). */
export function ussdTelUri(ussd) {
  return `tel:${String(ussd).replace(/#/g, "%23")}`;
}

/** Masked receive number for admin screens: +256 75•••••291. */
export function maskedNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "";
  const country = digits.length >= 9 ? digits.slice(0, 3) : "";
  const national = country ? digits.slice(3) : digits;
  if (national.length <= 5) return "+" + digits.slice(0, 2) + "•".repeat(Math.max(2, national.length - 3)) + national.slice(-3);
  const head = national.slice(0, 2);
  const tail = national.slice(-3);
  const bullets = "•".repeat(Math.max(3, national.length - 5));
  return `+${country} ${head}${bullets}${tail}`;
}

/**
 * Public USSD templates may contain {amount} only. They must never embed the
 * receive number or reference it. Returns an error string or null.
 */
export function validPublicUssdTemplate(template, number) {
  const tpl = String(template || "").trim();
  if (!tpl) return "USSD template is required.";
  if (tpl.includes("{number}")) return "The receive number must never be embedded in the customer template.";
  if (!/^[\d*#{}a-zA-Z +.-]+$/.test(tpl)) return "USSD template contains unsupported characters.";
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.length >= 7 && tpl.replace(/\D/g, "").includes(digits)) {
    return "The template must not contain the receive number.";
  }
  if (!tpl.includes("{amount}")) return "The template must contain the {amount} placeholder.";
  return null;
}

/** Manual top-up options the admin can switch on/off. */
export function manualTopupChannels() {
  const cfg = getSetting("paymentConfig", null);
  const offlineEnabled = cfg?.channels?.OFFLINE?.enabled ?? cfg?.offline?.enabled ?? true;
  const momo = momoTopupConfig();
  const out = [];
  out.push({
    code: "MOBILE_MONEY", label: "Mobile money (MTN / Airtel)", integration: "manual",
    method: "MOBILE_MONEY_MANUAL",
    enabled: momo.enabled !== false, configured: momo.enabled !== false,
    // Public copy only — settlement number stays private; the per-payment
    // QR/USSD is generated server-side from the authorized amount.
    network: momo.networkLabel,
    instructions: "Scan or dial the code shown for your amount, pay from your phone, then submit the transaction reference.",
    topup: true, invoice: true,
  });
  out.push({
    code: "OFFLINE", label: "Bank transfer / offline", integration: "manual",
    enabled: offlineEnabled, configured: true,
    instructions: cfg?.offline?.instructions || "", topup: true, invoice: true,
  });
  return out;
}

/* ------------------------------- wallet currencies ------------------------------- */

/** App-fixed USD↔UGX conversion (mirrors intl.js seed rate). */
export const RATE_USD_UGX = 3700;

/** Uganda members keep UGX wallets; everywhere else defaults to USD. */
export function memberWalletCurrency(member) {
  return String(member?.homeCountry || "") === "Uganda" ? "UGX" : "USD";
}

/** Minimum top-up enforced server-side (USD 10 / UGX 37 000). */
export function walletMinTopup(currency) {
  return currency === "UGX" ? 37000 : 10;
}

/* ------------------------------- settings ------------------------------- */

/** settings rows: { _id, key, value } (array so Neon sync keeps working). */
export function getSetting(key, fallback = null) {
  const row = (db.data.settings || []).find((s) => s.key === key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.data.settings = db.data.settings || [];
  let row = db.data.settings.find((s) => s.key === key);
  if (row) row.value = value;
  else db.data.settings.push({ _id: crypto.randomUUID(), key, value });
  db.persist();
  return value;
}

/** Which channels may be offered to a member today (admin-selectable):
 * - WALLET always available (internal ledger).
 * - Manual: MOBILE_MONEY (receive number/USSD) and OFFLINE (bank) appear when
 *   finance enabled them; disabled manual channels are omitted for members.
 * - API providers always appear (locked state) so members see the honest
 *   "Integration prepared — provider credentials required" / "coming soon"
 *   status instead of nothing.
 */
export function configuredChannels() {
  const cfg = getSetting("paymentConfig", null);
  const out = [];
  const manual = manualTopupChannels();
  for (const ch of manual) {
    if (ch.code === "MOBILE_MONEY" && ch.enabled === false) continue;
    out.push(ch);
  }
  out.push({ ...CHANNELS.find((c) => c.code === "WALLET"), configured: true });
  for (const ch of CHANNELS) {
    if (ch.integration !== "api") continue;
    const adminEnabled = cfg?.channels?.[ch.code]?.enabled === true;
    const status = describeProvider(ch.code) || { configured: false, message: "Integration prepared — provider credentials required." };
    out.push({ ...ch, configured: adminEnabled && status.configured, enabled: adminEnabled, providerStatus: status });
  }
  return out;
}

/** Channels a specific money flow may use (topup vs invoice checkout). */
export function channelsFor(purpose) {
  return configuredChannels().filter((c) => c[purpose] !== false);
}

/** Channel-level guard for a requested channel on a given flow. */
export function channelReady(code, purpose = "topup") {
  const found = channelsFor(purpose).find((c) => c.code === code);
  if (!found) {
    const all = configuredChannels().find((c) => c.code === code);
    if (all?.integration === "api" && !all.configured) {
      return { ok: false, message: all.providerStatus?.message || "Integration prepared — provider credentials required." };
    }
    if (all?.code === "MOBILE_MONEY" || all?.code === "OFFLINE") {
      return { ok: false, message: "This payment option is currently disabled by SwiftKifisha." };
    }
    return { ok: false, message: "That payment channel is not available for this payment." };
  }
  if (found.integration === "api" && !found.configured) {
    return { ok: false, message: found.providerStatus?.message || "Integration prepared — provider credentials required." };
  }
  return { ok: true, channel: found };
}

/* ------------------------------- ids ------------------------------- */

export const freshId = (prefix) => `${prefix}-${Math.floor(100000 + Math.random() * 899999)}`;
export const shipmentId = () => freshId("SKS");
export const invoiceId = () => freshId("SKI");
export const paymentId = () => freshId("SKP");

/* ------------------------------- wallet ledger ------------------------------- */

/**
 * Immutable ledger rows: { _id, customerEmail, type: CREDIT|DEBIT,
 * reason, amount, currency, refType, refId, actor, createdAt }.
 * balanceAfter is computed from the last row for that customer.
 */
export function ledgerBalance(email, currency = "USD") {
  return [...(db.data.ledger || [])]
    .filter((l) => l.customerEmail === email && (l.currency || "USD") === currency)
    .reduce((sum, l) => sum + (l.type === "CREDIT" ? l.amount : -l.amount), 0);
}

/** All wallet balances for a member. */
export function ledgerBalances(email) {
  const out = { USD: 0, UGX: 0 };
  for (const l of db.data.ledger || []) {
    if (l.customerEmail !== email) continue;
    const cur = l.currency || "USD";
    out[cur] = (out[cur] || 0) + (l.type === "CREDIT" ? l.amount : -l.amount);
  }
  return out;
}

export function addLedger({ email, type, amount, reason, refType, refId, actor, currency }) {
  const row = {
    _id: crypto.randomUUID(),
    customerEmail: email,
    type, // CREDIT | DEBIT
    amount: Math.round(Number(amount) * 100) / 100,
    currency: currency || "USD",
    reason: String(reason || "").slice(0, 300),
    refType: refType || null,
    refId: refId || null,
    actor: actor || "system",
    createdAt: new Date().toISOString(),
  };
  if (row.type === "CREDIT" && row.amount <= 0) throw new Error("Credit amount must be positive.");
  if (row.type === "DEBIT" && row.amount <= 0) throw new Error("Debit amount must be positive.");
  db.data.ledger = db.data.ledger || [];
  db.data.ledger.push(row);
  db.persist();
  return row;
}

/* ------------------------------- invoice helpers ------------------------------- */

/** Real line items for an invoice from the backend pricing rules. */
export function buildInvoiceLines({ packages, insurance, declaredValue, serviceType }) {
  const rule = (code, fallback) => {
    const row = (db.data.pricingRules || []).find((r) => r.code === code);
    return row ? row.value : fallback;
  };
  const chargeableKg = packages.reduce((s, p) => s + Number(p.chargeableWeight || p.weight || 0), 0);
  const declValue = declaredValue ?? packages.reduce((s, p) => s + Number(p.declaredValue || 0), 0);
  const basePerKg = Number(rule("rate.basePerKgUSD", 8));
  const handling = Number(rule("fees.originsHandling", 5));
  const insuranceRate = Number(rule("insurance.ratePct", 2.5));
  const dailyRate = Number(rule("storage.dailyRateUSD", 0.5));

  const freight = Math.round(chargeableKg * basePerKg * 100) / 100;
  const insurancePremium = insurance ? Math.round(((declValue * insuranceRate) / 100) * 100) / 100 : 0;
  // Storage overdue per package, computed from the same rules the member sees.
  let storage = 0;
  const now = Date.now();
  for (const p of packages) {
    if (!p.receivedAt) continue;
    const freeDays = Number(rule("storage.freeDays", 7));
    const freeUntil = new Date(new Date(p.receivedAt).getTime() + freeDays * 86400000).getTime();
    const overdueDays = Math.floor((now - freeUntil) / 86400000);
    if (overdueDays > 0) storage += Math.round(overdueDays * dailyRate * 100) / 100;
  }

  const lines = [
    { code: "freight", label: `Base freight (${chargeableKg.toFixed(2)} kg billable)`, qty: 1, amount: freight },
    { code: "handling", label: "Warehouse handling", qty: 1, amount: handling },
  ];
  if (insurancePremium > 0) {
    lines.push({ code: "insurance", label: `Shipment protection (${insuranceRate}% of ${declValue})`, qty: 1, amount: insurancePremium });
  }
  if (storage > 0) {
    lines.push({ code: "storage", label: "Overdue warehouse storage", qty: 1, amount: storage });
  }
  const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const total = subtotal; // tax/discount rules are zero in Phase 2 by design
  return { lines, subtotal, total, chargeableKg, declaredValue: declValue, serviceType: String(serviceType || "standard") };
}

/** Money rounding helper. */
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
