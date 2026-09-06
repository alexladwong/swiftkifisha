/**
 * Phase-2 money API: checkout, invoices, payments (server-verified only),
 * wallet/ledger, dispatch shipments + staff tracking events, pricing config.
 * Mounted at /api. All money mutations are audited; no frontend-trusted
 * payment success exists anywhere.
 */
import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { db } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { addAudit, withIdempotency, ruleValue } from "../lib/commerce.js";
import { sendGenericEmail } from "../lib/mailer.js";
import {
  PAYMENT_STATUS, INVOICE_STATUS, SHIPMENT_STATUS, SHIPMENT_TRANSITIONS,
  canPayTransition, canShipTransition,
  configuredChannels, channelReady, getSetting, setSetting,
  shipmentId, invoiceId, paymentId,
  ledgerBalance, ledgerBalances, addLedger, buildInvoiceLines, money,
  memberWalletCurrency, walletMinTopup, RATE_USD_UGX, momoTopupConfig,
  publicUssd, privateUssd, ussdTelUri, maskedNumber, validPublicUssdTemplate, MOMO_DIAL_DEFAULT,
  fxConvert,
} from "../lib/money.js";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import QRCode from "qrcode";
import { describeProvider, describeAllProviders, verifyProviderWebhook, hashEvent, PROVIDER_BY_CODE, testDarajaConnection, providerCanInitiate } from "../lib/paymentProviders.js";
import { initiateStkPush, queryStkStatus, parseStkCallback, normalizeMsisdn, mpesaConfigured, MPESA_RESULT_MAP, mpesaShortcodeSet } from "../lib/mpesa.js";

const router = Router();
const PROOF_DIR = path.join(config.root, "data", "uploads", "proofs");
fs.mkdirSync(PROOF_DIR, { recursive: true });
const proofStorage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, PROOF_DIR),
  filename: (_r, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname || ".jpg").toLowerCase()),
});
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(f.mimetype);
    if (ok) return cb(null, true);
    const e = new Error("Proof must be a JPEG, PNG, WEBP or GIF image (max 5 MB).");
    e.statusCode = 400;
    cb(e, false);
  },
});

/* --------------------------------- helpers --------------------------------- */

const memberByToken = (req) => db.data.users.find((u) => u._id === req.user._id);
const requireRole = (roles) => (req, res, next) => {
  const has = (req.user?.role || "").toUpperCase();
  if (!req.user || !roles.some((r) => r.toUpperCase() === has)) {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
};
const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "WAREHOUSE_MANAGER", "WAREHOUSE_AGENT", "CUSTOMER_SUPPORT", "FINANCE"];
const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
const WEB_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
const round = money;

const memberRow = (user) => (db.data.members || []).find((m) => m.email === user.email);

const validDestination = (d) => {
  const r = (s) => String(s || "").trim();
  return r(d.recipientName) && r(d.line1) && r(d.city) && r(d.country);
};

/** Public-only mobile-money summary — never the settlement number. */
function publicMomoSummary() {
  const momo = momoTopupConfig();
  return { method: "MOBILE_MONEY_MANUAL", network: momo.networkLabel, enabled: momo.enabled !== false };
}

/** Effective charge amount/currency for a payment (settlement when present). */
function settlementOf(p) {
  if (p?.settlementAmount != null && p?.settlementCurrency) {
    return { amount: p.settlementAmount, currency: p.settlementCurrency };
  }
  return { amount: p?.amount, currency: p?.currency || "USD" };
}

function emailMember(to, subject, html) {
  sendGenericEmail({ to, subject, html }).catch((e) => console.error(`[mail] ${subject} -> ${to} failed:`, e?.message ?? e));
}

/** Applies a paid payment to its invoice; returns { invoice, shipment? }. */
function applyPaymentToInvoice(payment) {
  const invoice = (db.data.invoices || []).find((i) => i._id === payment.invoiceId);
  if (!invoice || invoice.status === "VOID") return { invoice: null, shipment: null };
  const paid = (db.data.payments || [])
    .filter((p) => p.invoiceId === invoice._id && p.status === "PAID")
    .reduce((s, p) => s + (p.amount || 0), 0);
  invoice.amountPaid = round(Math.min(invoice.total, paid));
  invoice.balance = round(invoice.total - invoice.amountPaid);
  invoice.status = invoice.balance <= 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIAL;
  if (invoice.status === "PAID") {
    invoice.paidAt = new Date().toISOString();
    // Settled elsewhere — retire sibling pending attempts so the member sees
    // no stale "awaiting confirmation" rows.
    for (const p of db.data.payments || []) {
      if (p.invoiceId === invoice._id && p.status === "PENDING" && p._id !== payment._id) {
        p.status = "CANCELLED";
        p.note = (p.note ? p.note + " — " : "") + "Auto-cancelled: invoice settled by " + (payment.paymentId || payment._id);
        p.updatedAt = new Date().toISOString();
      }
    }
  }
  let shipment = null;
  if (invoice.status === "PAID") shipment = maybeCreateShipment(invoice);
  return { invoice, shipment };
}

/** Real dispatch row created only after full payment (no fake bookings). */
function maybeCreateShipment(invoice) {
  const exists = (db.data.shipments || []).some((s) => s.invoiceId === invoice._id);
  if (exists) return (db.data.shipments || []).find((s) => s.invoiceId === invoice._id);
  const member = (db.data.members || []).find((m) => m.email === invoice.customerEmail);
  const origin = (db.data.warehouses || []).find((w) => w._id === invoice.originWarehouseId);
  const shipment = {
    _id: crypto.randomUUID(),
    shipmentId: shipmentId(),
    invoiceId: invoice._id,
    customerEmail: invoice.customerEmail,
    memberCode: member?.memberCode || null,
    packageIds: [...(invoice.packageIds || [])],
    originWarehouseId: invoice.originWarehouseId || null,
    originWarehouseCountry: origin?.country || invoice.originWarehouseCountry || "",
    destinationAddress: invoice.destinationAddress || null,
    carrierCode: "SWIFT_INTERNAL", // real carrier adapters require credentials
    carrierName: "SwiftKifisha Ops (internal handover)",
    serviceType: invoice.serviceType || "standard",
    chargeableWeightKg: invoice.chargeableWeightKg || 0,
    declaredValue: invoice.declaredValue || 0,
    currency: "USD",
    insurance: Boolean(invoice.insurance),
    total: invoice.total,
    status: SHIPMENT_STATUS.CREATED,
    events: [{
      status: "CREATED",
      location: origin?.city ? `${origin.city}, ${origin.country}` : "",
      note: "Dispatch created after payment confirmation.",
      actor: "system",
      actorEmail: null,
      at: new Date().toISOString(),
    }],
    createdAt: new Date().toISOString(),
  };
  db.data.shipments = db.data.shipments || [];
  db.data.shipments.push(shipment);
  // Move the customer's packages onto the dispatch (machine-allowed).
  for (const pid of shipment.packageIds) {
    const pkg = (db.data.packages || []).find((p) => p._id === pid || p.packageId === pid);
    if (!pkg || pkg.status !== "READY_FOR_PAYMENT") continue;
    pkg.status = "SHIPMENT_CREATED";
    pkg.shipmentId = shipment._id;
    pkg.updatedAt = new Date().toISOString();
    addAudit({ actorId: null, actorEmail: "system", actorRole: "system", action: "PACKAGE_LINKED_TO_SHIPMENT", entity: "package", entityId: pkg._id, changes: { shipmentId: shipment._id, packageId: pkg.packageId } });
  }
  addAudit({ actorId: null, actorEmail: "system", actorRole: "system", action: "SHIPMENT_CREATED", entity: "shipment", entityId: shipment._id, changes: { invoiceId: invoice._id, total: invoice.total } });
  emailMember(invoice.customerEmail, `Your shipment ${shipment.shipmentId} is being prepared`,
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
     <p>Payment confirmed — dispatch <strong>${shipment.shipmentId}</strong> is now being prepared at the warehouse.</p>
     <p><a href="${WEB_URL}/account/billing">Track it in your dashboard</a></p></div>`);
  return shipment;
}

/* ------------------------------ member: billing overview ------------------------------ */

/** GET /api/billing/overview — wallet balance, open invoices/payments. */
router.get("/billing/overview", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const inv = (db.data.invoices || []).filter((i) => i.customerEmail === user.email);
  const payments = (db.data.payments || []).filter((p) => p.customerEmail === user.email);
  const open = inv.filter((i) => i.status === "ISSUED" || i.status === "PARTIAL");
  const cfg = getSetting("paymentConfig", null);
  return res.json({
    wallet: { balance: round(ledgerBalance(user.email)), currency: "USD" },
    openInvoiceCount: open.length,
    openBalance: round(open.reduce((s, i) => s + i.balance, 0)),
    unpaidPayments: payments.filter((p) => p.status === "PENDING").length,
    recentInvoices: [...inv].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    recentPayments: [...payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    paymentInstructions: "",
    channels: configuredChannels(),
  });
}));

/* ------------------------------ member: checkout ------------------------------ */

/**
 * POST /api/checkout — turn READY_FOR_PAYMENT packages into a real invoice +
 * pending payment. Pricing is computed server-side from pricing rules.
 */
router.post("/checkout", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const member = memberRow(user);
  if (!member) return res.status(403).json({ message: "Member profile required." });
  const b = req.body || {};
  const ids = Array.isArray(b.packageIds) ? b.packageIds.map(String) : [];
  if (ids.length === 0) return res.status(400).json({ message: "Choose at least one package." });
  const dest = b.destinationAddress || {};
  if (!validDestination(dest)) {
    return res.status(400).json({ message: "Destination needs recipient name, address line 1, city and country." });
  }
  const pkgs = ids.map((id) => (db.data.packages || []).find((p) => p._id === id || p.packageId === id)).filter(Boolean);
  if (pkgs.length !== ids.length) return res.status(404).json({ message: "One or more packages were not found." });
  for (const p of pkgs) {
    if (p.customerEmail !== user.email) return res.status(403).json({ message: `Package ${p.packageId} is not yours.` });
    if (p.status !== "READY_FOR_PAYMENT") {
      return res.status(409).json({ message: `Package ${p.packageId} is ${p.status} — only packages awaiting payment can be shipped.` });
    }
  }
  const openFor = (db.data.invoices || []).some(
    (i) => i.customerEmail === user.email && (i.status === "ISSUED" || i.status === "PARTIAL") && i.packageIds.some((x) => ids.includes(x)),
  );
  if (openFor) return res.status(409).json({ message: "An unpaid invoice already covers one of these packages." });

  const built = buildInvoiceLines({
    packages: pkgs,
    insurance: b.insurance === true,
    declaredValue: b.declaredValue !== undefined ? Number(b.declaredValue) : null,
    serviceType: String(b.serviceType || "standard"),
  });
  const invoice = {
    _id: crypto.randomUUID(),
    invoiceId: invoiceId(),
    customerEmail: user.email,
    memberCode: member.memberCode,
    packageIds: pkgs.map((p) => p._id),
    packageRefs: pkgs.map((p) => p.packageId),
    originWarehouseId: pkgs[0].warehouseId || null,
    originWarehouseCountry: pkgs[0].warehouseCountry || "",
    destinationAddress: {
      recipientName: String(dest.recipientName).trim().slice(0, 120),
      phone: String(dest.phone || "").trim().slice(0, 40),
      email: String(dest.email || "").trim().slice(0, 120),
      line1: String(dest.line1).trim().slice(0, 160),
      line2: String(dest.line2 || "").trim().slice(0, 160),
      city: String(dest.city).trim().slice(0, 80),
      region: String(dest.region || "").trim().slice(0, 80),
      postalCode: String(dest.postalCode || "").trim().slice(0, 20),
      country: String(dest.country).trim().slice(0, 80),
    },
    lineItems: built.lines,
    chargeableWeightKg: round(built.chargeableKg),
    declaredValue: round(built.declaredValue),
    insurance: b.insurance === true,
    serviceType: built.serviceType,
    subtotal: round(built.subtotal),
    total: round(built.total),
    currency: "USD",
    amountPaid: 0,
    balance: round(built.total),
    status: INVOICE_STATUS.ISSUED,
    createdAt: new Date().toISOString(),
    dueNote: "Payment is confirmed manually after the transfer lands (offline channel) or instantly from wallet credit.",
  };
  db.data.invoices = db.data.invoices || [];
  db.data.invoices.push(invoice);
  const wantChannel = String(b.channel || "OFFLINE");
  const ready = channelReady(wantChannel, "invoice");
  if (!ready.ok) return res.status(409).json({ message: ready.message });
  let settlementFields = {};
  if (wantChannel === "MOBILE_MONEY" && invoice.currency !== "UGX") {
    const conv = fxConvert(invoice.total, invoice.currency || "USD", "UGX");
    if (conv.error) {
      return res.status(409).json({ message: `${conv.error} Mobile money settles in UGX.` });
    }
    settlementFields = {
      settlementAmount: conv.converted,
      settlementCurrency: "UGX",
      rate: conv.rate,
      ruleCode: conv.ruleCode,
      sourceAmount: invoice.total,
      sourceCurrency: invoice.currency || "USD",
    };
  }
  const payment = {
    _id: crypto.randomUUID(),
    paymentId: paymentId(),
    customerEmail: user.email,
    invoiceId: invoice._id,
    type: "INVOICE",
    amount: invoice.total,
    currency: "USD",
    channel: wantChannel,
    status: PAYMENT_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    note: "Awaiting payment",
    ...settlementFields,
  };
  db.data.payments = db.data.payments || [];
  db.data.payments.push(payment);
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "CHECKOUT_INVOICE_ISSUED", entity: "invoice", entityId: invoice._id, changes: { invoiceId: invoice.invoiceId, total: invoice.total, packages: pkgs.map((p) => p.packageId) } });
  emailMember(user.email, `Invoice ${invoice.invoiceId} is ready (${invoice.total} USD)`,
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
     <p>Hi ${user.name}, invoice <strong>${invoice.invoiceId}</strong> for ${invoice.total} USD is ready.</p>
     <p>Payment instructions appear in your dashboard once the finance team configures them; wallet credit pays instantly.</p>
     <p><a href="${WEB_URL}/account/billing">Open billing</a></p></div>`);
  const cfg = getSetting("paymentConfig", null);
  return res.status(201).json({
    message: "Invoice created — payment is pending confirmation.",
    invoice, payment,
    paymentInstructions: "",
    channels: configuredChannels(),
  });
}));

/* ------------------------------ member: invoices/payments ------------------------------ */

router.get("/invoices", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const rows = (db.data.invoices || []).filter((i) => i.customerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ invoices: rows });
}));

router.get("/invoices/:id", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const invoice = (db.data.invoices || []).find((i) => (i._id === req.params.id || i.invoiceId === req.params.id) && i.customerEmail === user.email);
  if (!invoice) return res.status(404).json({ message: "Invoice not found." });
  const payments = (db.data.payments || []).filter((p) => p.invoiceId === invoice._id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const shipment = (db.data.shipments || []).find((s) => s.invoiceId === invoice._id) || null;
  const pkgs = (db.data.packages || []).filter((p) => invoice.packageIds.includes(p._id)).map((p) => ({
    _id: p._id, packageId: p.packageId, status: p.status, merchant: p.merchant, photos: (p.photos || []).length,
  }));
  return res.json({ invoice, payments, shipment, packages: pkgs });
}));

/** POST /api/invoices/:id/cancel — member voids an unpaid invoice. */
router.post("/invoices/:id/cancel", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const invoice = (db.data.invoices || []).find((i) => (i._id === req.params.id || i.invoiceId === req.params.id) && i.customerEmail === user.email);
  if (!invoice) return res.status(404).json({ message: "Invoice not found." });
  if (invoice.status === "VOID") return res.json({ message: "Invoice already voided.", invoice });
  if (invoice.status === "PAID") return res.status(409).json({ message: "A paid invoice cannot be voided — contact support." });
  const paid = (db.data.payments || []).some((p) => p.invoiceId === invoice._id && p.status === "PAID");
  if (paid) return res.status(409).json({ message: "This invoice already has confirmed payments." });
  for (const p of (db.data.payments || [])) {
    if (p.invoiceId === invoice._id && p.status === "PENDING") { p.status = "CANCELLED"; p.updatedAt = new Date().toISOString(); }
  }
  invoice.status = "VOID";
  invoice.voidedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "INVOICE_VOIDED", entity: "invoice", entityId: invoice._id, reason: String((req.body || {}).reason || "").slice(0, 300) });
  return res.json({ message: "Invoice voided; packages are available again.", invoice });
}));

router.get("/payments", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const rows = (db.data.payments || []).filter((p) => p.customerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ payments: rows });
}));

/** POST /api/payments/:id/cancel — member cancels their own pending payment. */
router.post("/payments/:id/cancel", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((p) => (p._id === req.params.id || p.paymentId === req.params.id) && p.customerEmail === user.email);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (payment.status !== "PENDING") return res.status(409).json({ message: `Only pending payments can be cancelled (status ${payment.status}).` });
  payment.status = "CANCELLED";
  payment.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "PAYMENT_CANCELLED", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId } });
  return res.json({ message: "Payment cancelled.", payment });
}));

/* ------------------------------ member: wallet ------------------------------ */

router.get("/wallet", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const member = memberRow(user);
  const balances = ledgerBalances(user.email);
  const rows = (db.data.ledger || []).filter((l) => l.customerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
  const walletCurrency = memberWalletCurrency(member);
  return res.json({
    balance: round(balances.USD || 0),
    currency: "USD",
    walletCurrency,
    balances: { USD: round(balances.USD || 0), UGX: round(balances.UGX || 0) },
    minTopup: { amount: walletMinTopup(walletCurrency), currency: walletCurrency },
    rateUsdUgx: RATE_USD_UGX,
    channels: configuredChannels(),
    momo: publicMomoSummary(),
    entries: rows,
  });
}));

/**
 * POST /api/wallet/topup — member requests wallet credit.
 * Creates a PENDING payment in the member's wallet currency (UGX for Uganda,
 * USD elsewhere). Money becomes credit ONLY after finance verifies the
 * transfer (or a future provider webhook) — never automatically.
 */
router.post("/wallet/topup", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const member = memberRow(user);
  if (!member) return res.status(403).json({ message: "Member profile required." });
  let currency = memberWalletCurrency(member);
  const wantCur = String((req.body || {}).currency || "").toUpperCase();
  if (wantCur === "KES") currency = "KES"; // M-Pesa (Daraja) settlement currency
  const min = currency === "KES" ? Math.max(1, Math.round(Number(ruleValue("topup.minKes", 100)) || 100)) : walletMinTopup(currency);
  const amount = Math.round((Number((req.body || {}).amount) || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: `Enter an amount to top up (minimum ${min} ${currency}).` });
  }
  if (amount < min) {
    return res.status(400).json({ message: `Minimum top-up is ${min} ${currency}${currency === "UGX" ? ` (≈ USD ${(min / RATE_USD_UGX).toFixed(2)})` : ""}.` });
  }
  const wantChannel = String((req.body || {}).channel || (momoTopupConfig().enabled !== false ? "MOBILE_MONEY" : "OFFLINE"));
  const ready = channelReady(wantChannel, "topup");
  if (!ready.ok) return res.status(409).json({ message: ready.message });
  const cfg = getSetting("paymentConfig", null);
  const momo = momoTopupConfig();
  const publicChannels = configuredChannels();
  const instructions = publicChannels.find((c) => c.code === wantChannel)?.instructions || "";
  const payment = {
    _id: crypto.randomUUID(),
    paymentId: paymentId(),
    customerEmail: user.email,
    invoiceId: null,
    type: "TOPUP",
    amount,
    currency,
    channel: wantChannel,
    status: PAYMENT_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    note: wantChannel === "MOBILE_MONEY" ? "Mobile-money top-up awaiting confirmation" : "Wallet top-up awaiting confirmation",
  };
  db.data.payments = db.data.payments || [];
  db.data.payments.push(payment);
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "WALLET_TOPUP_REQUESTED", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, amount, currency } });
  emailMember(user.email, `Wallet top-up ${payment.paymentId} (${amount} ${currency})`,
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
     <p>Hi ${user.name}, your wallet top-up of <strong>${amount} ${currency}</strong> is awaiting confirmation.</p>
     ${instructions ? `<p style="color:#0f172a">${instructions.replace(/</g, "&lt;")}</p>` : "<p>Payment instructions will appear once finance configures them.</p>"}
     <p>Credit is added after we confirm the transfer.</p></div>`);
  return res.status(201).json({
    message: `Top-up requested — ${amount} ${currency} will be credited after confirmation.`,
    payment, paymentInstructions: instructions, channels: configuredChannels(),
    walletCurrency: currency, minTopup: { amount: min, currency },
    momo: publicMomoSummary(),
  });
}));

/** POST /api/wallet/pay-invoice — spend wallet credit on an invoice (server-side, audited). */
router.post("/wallet/pay-invoice", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const invoice = (db.data.invoices || []).find((i) => (i._id === req.body.invoiceId || i.invoiceId === req.body.invoiceId) && i.customerEmail === user.email);
  if (!invoice) return res.status(404).json({ message: "Invoice not found." });
  if (invoice.status === "VOID") return res.status(409).json({ message: "Invoice is voided." });
  if (invoice.balance <= 0) return res.status(409).json({ message: "Invoice already settled." });
  const member = memberRow(user);
  const invCur = invoice.currency || "USD";
  const sourceCur = memberWalletCurrency(member); // how this member funds their wallet
  const fx = sourceCur === invCur ? { converted: invoice.balance, rate: 1 } : fxConvert(invoice.balance, invCur, sourceCur);
  if (fx.error) return res.status(409).json({ message: fx.error });
  const needed = fx.converted;
  const balance = round(ledgerBalance(user.email, sourceCur));
  if (balance < needed) {
    return res.status(409).json({ message: `Wallet balance ${balance} ${sourceCur} is below the ${needed} ${sourceCur} needed for this ${invoice.balance} ${invCur} invoice.` });
  }
  const existing = (db.data.payments || []).some((p) => p.invoiceId === invoice._id && p.status === "PAID");
  const payment = {
    _id: crypto.randomUUID(),
    paymentId: paymentId(),
    customerEmail: user.email,
    invoiceId: invoice._id,
    type: "INVOICE",
    amount: invoice.balance,
    currency: invCur,
    channel: "WALLET",
    status: PAYMENT_STATUS.PAID,
    reference: "wallet-ledger-debit",
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    verifiedBy: "system:wallet",
    note: sourceCur === invCur ? "Paid from account credit" : `Paid from ${sourceCur} wallet credit at ${fx.rate} ${invCur}/${sourceCur}`,
    ...(sourceCur !== invCur
      ? { sourceAmount: fx.converted, sourceCurrency: sourceCur, rate: fx.rate, ruleCode: fx.ruleCode, settlementAmount: invoice.balance, settlementCurrency: invCur }
      : {}),
  };
  db.data.payments = db.data.payments || [];
  db.data.payments.push(payment);
  const entry = addLedger({
    email: user.email, type: "DEBIT", amount: fx.converted, currency: sourceCur,
    reason: `Payment ${payment.paymentId} on invoice ${invoice.invoiceId}${sourceCur !== invCur ? ` (${fx.converted} ${sourceCur} @ ${fx.rate})` : ""}`, refType: "payment", refId: payment._id, actor: "system:wallet",
  });
  db.persist();
  const { invoice: inv, shipment } = applyPaymentToInvoice(payment);
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "PAYMENT_WALLET", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, amount: payment.amount, invoiceId: invoice.invoiceId, ledgerId: entry._id } });
  return res.json({
    message: shipment ? "Paid — your shipment is being prepared." : "Paid from wallet credit.",
    payment, invoice: inv, shipment,
  });
}));

/** GET /api/ledger — member ledger history (alias of /wallet entries). */
router.get("/ledger", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const rows = (db.data.ledger || []).filter((l) => l.customerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  return res.json({ entries: rows, balances: ledgerBalances(user.email) });
}));

/* ------------------------------ member: payment detail + mobile money ------------------------------ */

/** GET /api/payments/:id — own payment + payment-scoped mobile-money data (public only). */
router.get("/payments/:id", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((x) => (x._id === req.params.id || x.paymentId === req.params.id) && x.customerEmail === user.email);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  const out = { payment };
  if (payment.provider === "MPESA" || payment.channel === "MPESA") {
    out.providerPayment = {
      provider: "MPESA",
      status: payment.status,
      checkoutRequestId: payment.checkoutRequestId || null,
      merchantRequestId: payment.merchantRequestId || null,
      receipt: payment.providerReceipt || null,
      providerResultCode: payment.providerResultCode ?? null,
      providerResultDesc: payment.providerResultDesc || null,
      phoneMasked: payment.phoneMasked || null,
      settlementAmount: payment.settlementAmount ?? payment.amount,
      settlementCurrency: payment.settlementCurrency || payment.currency || "KES",
      message: payment.status === "PAID"
        ? "Payment confirmed."
        : payment.status === "PROCESSING"
          ? "Waiting for confirmation — check your phone and enter your M-Pesa PIN."
          : payment.status === "CANCELLED"
            ? "Payment was cancelled."
            : payment.status === "EXPIRED"
              ? "Payment request expired — try again."
              : payment.status === "FAILED"
                ? "Payment failed. Try again or contact finance."
                : "Ready to start the M-Pesa payment.",
    };
  }
  if (payment.channel === "MOBILE_MONEY" && ["PENDING", "PAYMENT_SUBMITTED"].includes(payment.status)) {
    const momo = momoTopupConfig();
    const invoice = payment.invoiceId ? (db.data.invoices || []).find((i) => i._id === payment.invoiceId) : null;
    const charge = settlementOf(payment);
    out.mobileMoney = {
      method: "MOBILE_MONEY_MANUAL",
      network: momo.networkLabel,
      amount: charge.amount,
      currency: charge.currency,
      ussd: publicUssd(charge.amount, momo.ussdTemplate),
      qrUrl: `/api/payments/${payment._id}/mobile-money-qr`,
      dialUrl: `/api/payments/${payment._id}/mobile-money-dial`,
      invoiceReference: invoice?.invoiceId || payment.paymentId,
    };
  }
  return res.json(out);
}));

/**
 * GET /api/payments/:id/mobile-money-qr — server-rendered QR image (owner
 * only). The dial payload (incl. settlement routing) is built on the backend;
 * the browser only ever receives the image, so the receive number never
 * enters frontend state, bundles, or logs.
 */
router.get("/payments/:id/mobile-money-qr", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((x) => (x._id === req.params.id || x.paymentId === req.params.id) && x.customerEmail === user.email);
  if (!payment || payment.channel !== "MOBILE_MONEY" || !["PENDING", "PAYMENT_SUBMITTED"].includes(payment.status)) {
    return res.status(404).json({ message: "Payment not found." });
  }
  const momo = momoTopupConfig();
  const charge = settlementOf(payment);
  const dial = privateUssd(charge.amount, momo.dialTemplate || MOMO_DIAL_DEFAULT, momo.number);
  try {
    const png = await QRCode.toBuffer(ussdTelUri(dial), { type: "png", width: 520, margin: 1, errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(png);
  } catch (err) {
    console.error("[qr] generation failed:", err?.message ?? err);
    return res.status(500).json({ message: "QR generation failed." });
  }
}));

/**
 * GET /api/payments/:id/mobile-money-dial — on-tap tel: URI (owner only).
 * Returned only when the member presses "Pay on phone"; never listed, never
 * cached.
 */
router.get("/payments/:id/mobile-money-dial", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((x) => (x._id === req.params.id || x.paymentId === req.params.id) && x.customerEmail === user.email);
  if (!payment || payment.channel !== "MOBILE_MONEY" || !["PENDING", "PAYMENT_SUBMITTED"].includes(payment.status)) {
    return res.status(404).json({ message: "Payment not found." });
  }
  const momo = momoTopupConfig();
  const charge = settlementOf(payment);
  const dial = privateUssd(charge.amount, momo.dialTemplate || MOMO_DIAL_DEFAULT, momo.number);
  res.setHeader("Cache-Control", "no-store");
  return res.json({ telUri: ussdTelUri(dial) });
}));

/** GET /api/payments/:id/recipient — payer-only recipient reveal for active
 * manual mobile-money payments (operator Send Money menus require typing the
 * recipient). Masked by default; full number only on explicit reveal. */
router.get("/payments/:id/recipient", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((x) => (x._id === req.params.id || x.paymentId === req.params.id) && x.customerEmail === user.email);
  if (!payment || payment.channel !== "MOBILE_MONEY" || !["PENDING", "PAYMENT_SUBMITTED"].includes(payment.status)) {
    return res.status(404).json({ message: "Payment not found." });
  }
  const momo = momoTopupConfig();
  const reveal = req.query.reveal === "true";
  const masked = maskedNumber(momo.number);
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    recipientName: "SwiftKifisha",
    network: momo.networkLabel,
    masked: reveal ? momo.number : masked,
    revealable: true,
  });
}));

/**
 * POST /api/payments/:id/submit — member submits their transaction reference
 * after paying. NEVER marks the payment paid: it moves PENDING →
 * PAYMENT_SUBMITTED for finance verification. Duplicate references are
 * rejected globally (one reference can never credit two payments).
 */
router.post("/payments/:id/submit", requireAuth, proofUpload.single("screenshot"), ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((x) => (x._id === req.params.id || x.paymentId === req.params.id) && x.customerEmail === user.email);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (!["PENDING", "PROCESSING"].includes(payment.status)) {
    return res.status(409).json({ message: `This payment is ${payment.status} — it cannot accept a submission now.` });
  }
  if (!["MOBILE_MONEY", "OFFLINE"].includes(payment.channel)) {
    return res.status(409).json({ message: "Submissions are only for manual payment channels." });
  }
  const reference = String(req.body.reference || "").trim().toUpperCase();
  const cleanup = () => { if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* best effort */ } } };
  if (reference.length < 4 || reference.length > 80 || !/^[A-Z0-9 .-]+$/.test(reference)) {
    cleanup();
    return res.status(400).json({ message: "Enter the transaction reference from your payment (letters, digits, dots or dashes)." });
  }
  const dup = (db.data.payments || []).some(
    (q) => q._id !== payment._id && q.submission?.reference === reference && ["PAYMENT_SUBMITTED", "PAID"].includes(q.status),
  );
  if (dup) {
    cleanup();
    return res.status(409).json({ message: "This transaction reference was already used for another payment." });
  }
  payment.status = PAYMENT_STATUS.PAYMENT_SUBMITTED;
  payment.submission = {
    reference,
    note: String(req.body.note || "").trim().slice(0, 500),
    screenshotFile: req.file ? req.file.filename : null,
    submittedAt: new Date().toISOString(),
  };
  payment.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "PAYMENT_SUBMITTED", entity: "payment", entityId: payment._id, reason: String(req.body.note || "").trim().slice(0, 300), changes: { paymentId: payment.paymentId, reference, screenshot: Boolean(req.file) } });
  for (const admin of (db.data.users || []).filter((u) => u.role === "admin")) {
    emailMember(admin.email, `Payment ${payment.paymentId} submitted for verification`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
      <p>${user.email} submitted reference <strong>${reference}</strong> for ${payment.amount} ${payment.currency || "USD"} (${payment.paymentId}).</p>
      <p>Verify it in the admin Payments queue.</p></div>`);
  }
  emailMember(user.email, `Payment ${payment.paymentId} submitted`,
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
     <p>We received your transaction reference <strong>${reference}</strong>. Credit is added once finance confirms the payment.</p></div>`);
  return res.json({ message: "Reference submitted — our finance team will verify your payment.", payment });
}));

/** GET /api/admin/payments/:id/screenshot/:file — finance-only proof image. */
router.get("/admin/payments/:id/screenshot/:file", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const payment = (db.data.payments || []).find((p) => p._id === req.params.id || p.paymentId === req.params.id);
  if (!payment || payment.submission?.screenshotFile !== req.params.file) {
    return res.status(404).json({ message: "Screenshot not found." });
  }
  const filePath = path.join(PROOF_DIR, String(req.params.file));
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Screenshot not found." });
  res.setHeader("Content-Type", "image/" + (String(req.params.file).endsWith(".png") ? "png" : String(req.params.file).endsWith(".gif") ? "gif" : String(req.params.file).endsWith(".webp") ? "webp" : "jpeg"));
  return fs.createReadStream(filePath).pipe(res);
}));

/* ------------------------------ admin: payments ------------------------------ */

router.get("/admin/payments", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const { status, search } = req.query;
  let rows = [...(db.data.payments || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) rows = rows.filter((p) => p.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((p) => (p.paymentId || "").toLowerCase().includes(q) || (p.customerEmail || "").toLowerCase().includes(q) || (p.reference || "").toLowerCase().includes(q));
  }
  return res.json({ payments: rows });
}));

/** POST /api/admin/payments/:id/verify — FINANCE confirms receipt (bank/offline). Audited + idempotent. */
router.post("/admin/payments/:id/verify", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const payment = (db.data.payments || []).find((p) => p._id === req.params.id || p.paymentId === req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  const reason = String((req.body || {}).reason || "").trim().slice(0, 300);
  const reference = String((req.body || {}).reference || payment.submission?.reference || "").trim().slice(0, 120);
  if (!reason) return res.status(400).json({ message: "A verification reason is required (finance audit)." });
  if (payment.status === "PAID") return res.json({ message: "Payment already verified.", payment, invoice: null, shipment: null });
  if (!canPayTransition(payment.status, "PAID")) {
    return res.status(409).json({ message: `Cannot verify a payment in ${payment.status}.` });
  }
  return withIdempotency("verify:" + payment._id, 120000, () => {
    payment.status = "PAID";
    payment.reference = reference || payment.reference || "";
    payment.verifiedBy = req.user.email;
    payment.paidAt = new Date().toISOString();
    payment.updatedAt = new Date().toISOString();
    db.persist();
    let invoice = null;
    let shipment = null;
    let ledger = null;
    if (payment.type === "TOPUP" || !payment.invoiceId) {
      // Wallet top-up: credit the member's ledger in the payment currency.
      ledger = addLedger({
        email: payment.customerEmail, type: "CREDIT", amount: payment.amount,
        currency: payment.currency || "USD",
        reason: `Wallet top-up ${payment.paymentId} (verified ${reference ? "ref " + reference : ""})`,
        refType: "payment", refId: payment._id, actor: req.user.email,
      });
      addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "WALLET_TOPUP_VERIFIED", entity: "ledger", entityId: ledger._id, reason, changes: { paymentId: payment.paymentId, amount: payment.amount, currency: payment.currency || "USD" } });
    } else {
      const applied = applyPaymentToInvoice(payment);
      invoice = applied.invoice;
      shipment = applied.shipment;
      db.persist();
    }
    addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PAYMENT_VERIFIED", entity: "payment", entityId: payment._id, reason, changes: { paymentId: payment.paymentId, amount: payment.amount, currency: payment.currency || "USD", reference } });
    const cur = payment.currency || "USD";
    emailMember(payment.customerEmail, `Payment ${payment.paymentId} confirmed`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2><p>Your payment of <strong>${payment.amount} ${cur}</strong> was confirmed${invoice ? ` (invoice ${invoice.invoiceId})` : ledger ? " — wallet credited." : ""}.</p>${shipment ? `<p>Dispatch <strong>${shipment.shipmentId}</strong> is now being prepared.</p>` : ""}</div>`);
    return res.json({ message: shipment ? "Payment verified — shipment created." : ledger ? "Payment verified — wallet credited." : "Payment verified.", payment, invoice, shipment, ledger });
  });
}));

/** POST /api/admin/payments/:id/reject — finance rejects a pending payment. */
router.post("/admin/payments/:id/reject", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const payment = (db.data.payments || []).find((p) => p._id === req.params.id || p.paymentId === req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  const reason = String((req.body || {}).reason || "").trim().slice(0, 300);
  if (!reason) return res.status(400).json({ message: "A rejection reason is required." });
  const target = payment.status === "PAYMENT_SUBMITTED" ? "REJECTED" : "FAILED";
  if (!canPayTransition(payment.status, target)) return res.status(409).json({ message: `Cannot reject a payment in ${payment.status}.` });
  payment.status = target;
  payment.rejectReason = reason;
  payment.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PAYMENT_REJECTED", entity: "payment", entityId: payment._id, reason });
  return res.json({ message: "Payment rejected.", payment });
}));

/* ------------------------------ admin: invoices + wallet credit ------------------------------ */

router.get("/admin/invoices", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const { status, search } = req.query;
  let rows = [...(db.data.invoices || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) rows = rows.filter((i) => i.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((i) => (i.invoiceId || "").toLowerCase().includes(q) || (i.customerEmail || "").toLowerCase().includes(q) || (i.packageRefs || []).join(" ").toLowerCase().includes(q));
  }
  return res.json({ invoices: rows });
}));

/** GET /api/admin/invoices/:id — invoice + payments + shipment + packages (finance). */
router.get("/admin/invoices/:id", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const invoice = (db.data.invoices || []).find((i) => i._id === req.params.id || i.invoiceId === req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found." });
  const payments = (db.data.payments || []).filter((p) => p.invoiceId === invoice._id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const shipment = (db.data.shipments || []).find((s) => s.invoiceId === invoice._id) || null;
  const pkgs = (db.data.packages || []).filter((p) => invoice.packageIds.includes(p._id)).map((p) => ({
    _id: p._id, packageId: p.packageId, status: p.status, merchant: p.merchant, warehouseCountry: p.warehouseCountry,
  }));
  return res.json({ invoice, payments, shipment, packages: pkgs });
}));

/** POST /api/admin/wallet/credit — real account credit with an audited ledger row. */
router.post("/admin/wallet/credit", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const { email, amount, reason } = req.body || {};
  const target = String(email || "").toLowerCase().trim();
  const member = (db.data.members || []).find((m) => m.email === target);
  if (!member) return res.status(404).json({ message: "No member with that email." });
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: "Amount must be a positive number." });
  if (!String(reason || "").trim()) return res.status(400).json({ message: "A reason is required." });
  const entry = addLedger({ email: target, type: "CREDIT", amount: value, reason: String(reason).trim().slice(0, 300), refType: "manual", actor: req.user.email });
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "LEDGER_CREDIT", entity: "ledger", entityId: entry._id, reason: String(reason).trim().slice(0, 300), changes: { email: target, amount: value } });
  return res.json({ message: "Credit added.", entry, balance: round(ledgerBalance(target)) });
}));

/* ------------------------------ admin: payment config ------------------------------ */

router.get("/admin/payment-config", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const cfg = getSetting("paymentConfig", { offline: { enabled: true, instructions: "" } });
  const momo = momoTopupConfig();
  const reveal = req.query.reveal === "true";
  // config echoes the stored settings: strip private settlement fields unless
  // an authorized finance admin explicitly reveals them.
  const viewCfg = { ...cfg };
  if (cfg?.momo) {
    viewCfg.momo = { ...cfg.momo };
    if (!reveal) {
      delete viewCfg.momo.number;
      delete viewCfg.momo.dialTemplate;
    }
  }
  return res.json({
    config: viewCfg,
    channels: configuredChannels(),
    providers: describeAllProviders(),
    momo: {
      enabled: momo.enabled !== false,
      network: momo.network || "MTN",
      networkLabel: momo.networkLabel,
      ussdTemplate: momo.ussdTemplate,
      dialConfigured: Boolean(momo.dialTemplate),
      maskedNumber: maskedNumber(momo.number),
      ...(reveal ? { number: momo.number, dialTemplate: momo.dialTemplate || MOMO_DIAL_DEFAULT } : {}),
    },
  });
}));

/** PUT /api/admin/payment-config — admin supplies REAL payment instructions. */
router.put("/admin/payment-config", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const b = req.body || {};
  const prev = getSetting("paymentConfig", null) || {};
  const offline = {
    enabled: b.offline?.enabled !== false,
    instructions: String(b.offline?.instructions ?? prev.offline?.instructions ?? "").trim().slice(0, 2000),
  };
  const channels = { ...(prev.channels || {}) };
  if (b.channels && typeof b.channels === "object") {
    for (const [code, entry] of Object.entries(b.channels)) {
      if (entry && typeof entry.enabled === "boolean") {
        channels[code] = { ...(channels[code] || {}), enabled: entry.enabled };
      }
    }
  }
  const prevMomo = prev?.momo || {};
  const current = momoTopupConfig();
  const wantNumber = String(b.momo?.number ?? prevMomo.number ?? "").trim().slice(0, 24) || current.number;
  const wantUssd = String(b.momo?.ussdTemplate ?? prevMomo.ussdTemplate ?? "").trim().slice(0, 120) || current.ussdTemplate;
  const publicErr = validPublicUssdTemplate(wantUssd, wantNumber);
  if (publicErr) return res.status(400).json({ message: publicErr });
  let dial = String(b.momo?.dialTemplate ?? prevMomo.dialTemplate ?? "").trim().slice(0, 160);
  if (dial && !dial.includes("{amount}")) {
    return res.status(400).json({ message: "The private dial template must contain the {amount} placeholder." });
  }
  const network = String(b.momo?.network ?? prevMomo.network ?? current.network ?? "MTN").trim().toUpperCase().slice(0, 12);
  const momo = {
    enabled: b.momo?.enabled !== undefined ? b.momo.enabled === true : prevMomo.enabled !== false,
    number: wantNumber,
    network,
    networkLabel: String(b.momo?.networkLabel ?? prevMomo.networkLabel ?? "").trim().slice(0, 60) || (network === "AIRTEL" ? "Airtel Money (Uganda)" : "MTN Mobile Money (Uganda)"),
    ussdTemplate: wantUssd,
    ...(dial ? { dialTemplate: dial } : {}),
  };
  const value = { offline, channels, momo };
  setSetting("paymentConfig", value);
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PAYMENT_CONFIG_UPDATED", entity: "settings", entityId: "paymentConfig", changes: { offlineEnabled: offline.enabled, channels: Object.keys(channels), momoNumber: momo.number } });
  return res.json({ message: "Payment configuration saved.", config: value, providers: describeAllProviders() });
}));

/* ------------------------------ admin: shipments + events ------------------------------ */

router.get("/admin/shipments", requireAuth, requireRole(STAFF_ROLES), ah(async (req, res) => {
  const { status, search } = req.query;
  let rows = [...(db.data.shipments || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) rows = rows.filter((s) => s.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((s) => (s.shipmentId || "").toLowerCase().includes(q) || (s.customerEmail || "").toLowerCase().includes(q) || (s.packageRefs || []).join(" ").toLowerCase().includes(q));
  }
  return res.json({ shipments: rows.map((s) => ({ ...s, allowedTransitions: SHIPMENT_TRANSITIONS[s.status] || [] })) });
}));

router.get("/admin/shipments/:id", requireAuth, requireRole(STAFF_ROLES), ah(async (req, res) => {
  const s = (db.data.shipments || []).find((x) => x._id === req.params.id || x.shipmentId === req.params.id);
  if (!s) return res.status(404).json({ message: "Shipment not found." });
  const pkgs = (db.data.packages || []).filter((p) => s.packageIds.includes(p._id));
  const invoice = (db.data.invoices || []).find((i) => i._id === s.invoiceId) || null;
  return res.json({ shipment: { ...s, allowedTransitions: SHIPMENT_TRANSITIONS[s.status] || [] }, packages: pkgs, invoice });
}));

/**
 * POST /api/admin/shipments/:id/events — REAL staff tracking events only.
 * No carrier/webhook fabrications: every event records who + when.
 */
router.post("/admin/shipments/:id/events", requireAuth, requireRole(STAFF_ROLES), ah(async (req, res) => {
  const s = (db.data.shipments || []).find((x) => x._id === req.params.id || x.shipmentId === req.params.id);
  if (!s) return res.status(404).json({ message: "Shipment not found." });
  const to = String((req.body || {}).status || "");
  if (!Object.values(SHIPMENT_STATUS).includes(to)) return res.status(400).json({ message: "Unknown shipment status." });
  if (!canShipTransition(s.status, to)) return res.status(409).json({ message: `Invalid shipment transition ${s.status} → ${to}.` });
  const location = String((req.body || {}).location || "").trim().slice(0, 160);
  const note = String((req.body || {}).note || "").trim().slice(0, 1000);
  const before = s.status;
  s.status = to;
  s.events = s.events || [];
  s.events.push({ status: to, location, note, actor: req.user.name || req.user.email, actorEmail: req.user.email, at: new Date().toISOString() });
  if (to === "PICKED_UP") s.dispatchedAt = s.dispatchedAt || new Date().toISOString();
  if (to === "DELIVERED") s.deliveredAt = new Date().toISOString();
  s.updatedAt = new Date().toISOString();
  // Mirror the movement onto linked packages (state machine respected).
  if (["PICKED_UP", "IN_TRANSIT", "CUSTOMS_CLEARANCE", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"].includes(to)) {
    for (const pid of s.packageIds || []) {
      const pkg = (db.data.packages || []).find((p) => p._id === pid);
      if (!pkg || pkg.status !== "SHIPMENT_CREATED") continue;
      pkg.status = to === "DELIVERED" ? "DISPATCHED" : to === "EXCEPTION" ? "EXCEPTION" : "DISPATCHED";
      pkg.updatedAt = new Date().toISOString();
    }
  }
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "SHIPMENT_EVENT", entity: "shipment", entityId: s._id, reason: note, changes: { before, after: to, location } });
  if (to === "DELIVERED" || to === "EXCEPTION") {
    emailMember(s.customerEmail, `Shipment ${s.shipmentId}: ${to === "DELIVERED" ? "Delivered" : "Exception"}`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2><p>${to === "DELIVERED" ? "Your shipment was delivered." : "There is an exception on your shipment."}</p>${location ? `<p style="color:#64748b">${location}</p>` : ""}</div>`);
  }
  return res.json({ message: `Shipment ${to}.`, shipment: { ...s, allowedTransitions: SHIPMENT_TRANSITIONS[s.status] || [] } });
}));


/* ------------------------------ admin: pricing rules ------------------------------ */

/** Pricing lives in the backend only — clients never hard-code fees. */
router.get("/admin/pricing-rules", requireAuth, requireRole(STAFF_ROLES), ah(async (req, res) => {
  const rows = [...(db.data.pricingRules || [])].sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return res.json({ rules: rows });
}));

router.post("/admin/pricing-rules", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || "").trim().toLowerCase();
  const value = Number(b.value);
  if (!/^[a-z0-9.]+$/.test(code)) return res.status(400).json({ message: "Rule code must be lowercase letters/digits/dots." });
  if (!Number.isFinite(value)) return res.status(400).json({ message: "Value must be a number." });
  if ((db.data.pricingRules || []).some((r) => r.code === code)) {
    return res.status(409).json({ message: "A rule with that code already exists — edit it instead." });
  }
  const rule = {
    _id: crypto.randomUUID(),
    code,
    value,
    unit: String(b.unit || "").trim().slice(0, 20),
    note: String(b.note || "").trim().slice(0, 300),
    updatedBy: req.user.email,
    createdAt: new Date().toISOString(),
  };
  db.data.pricingRules = db.data.pricingRules || [];
  db.data.pricingRules.push(rule);
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PRICING_RULE_CREATED", entity: "pricingRules", entityId: rule._id, changes: { code, value } });
  return res.status(201).json({ message: "Pricing rule created.", rule });
}));

router.patch("/admin/pricing-rules/:id", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const rule = (db.data.pricingRules || []).find((r) => r._id === req.params.id || r.code === req.params.id);
  if (!rule) return res.status(404).json({ message: "Rule not found." });
  const b = req.body || {};
  const before = { value: rule.value, unit: rule.unit, note: rule.note };
  if (b.value !== undefined) {
    const value = Number(b.value);
    if (!Number.isFinite(value)) return res.status(400).json({ message: "Value must be a number." });
    rule.value = value;
  }
  if (b.unit !== undefined) rule.unit = String(b.unit).trim().slice(0, 20);
  if (b.note !== undefined) rule.note = String(b.note).trim().slice(0, 300);
  rule.updatedBy = req.user.email;
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PRICING_RULE_UPDATED", entity: "pricingRules", entityId: rule._id, changes: { before, after: { value: rule.value, unit: rule.unit, note: rule.note } } });
  return res.json({ message: "Pricing rule updated.", rule });
}));

router.delete("/admin/pricing-rules/:id", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const rule = (db.data.pricingRules || []).find((r) => r._id === req.params.id || r.code === req.params.id);
  if (!rule) return res.status(404).json({ message: "Rule not found." });
  db.data.pricingRules = db.data.pricingRules.filter((r) => r._id !== rule._id);
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PRICING_RULE_DELETED", entity: "pricingRules", entityId: rule._id, reason: "rule removed by finance", changes: { code: rule.code, value: rule.value } });
  return res.json({ message: "Pricing rule deleted." });
}));


/* ------------------------------ M-Pesa (Daraja) — real provider ------------------------------ */

// In-memory rate limiting (single-instance dev deployment): initiation 5/min
// per user; provider refresh 1 per 20 s per payment.
const mpesaInitHits = new Map();
const mpesaRefreshAt = new Map();

function hitRate(key, max, windowMs) {
  const now = Date.now();
  const arr = (mpesaInitHits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  mpesaInitHits.set(key, arr);
  return true;
}

/** Server-side currency settlement for an M-Pesa payment. */
function mpesaSettlement(payment) {
  const cur = String(process.env.MPESA_CURRENCY || "KES").toUpperCase();
  if ((payment.currency || "USD") === cur) {
    return { settlementAmount: Math.round(payment.amount), settlementCurrency: cur, rate: null, sourceAmount: payment.amount, sourceCurrency: payment.currency };
  }
  let rate = null;
  if (payment.currency === "UGX") rate = Number(ruleValue("mpesa.rateUgx", 0));
  else if (payment.currency === "USD") rate = Number(ruleValue("mpesa.rateUsd", 0));
  if (!(rate > 0)) {
    return { error: `M-Pesa charges in ${cur}. Add an explicit backend rate rule (mpesa.rateUgx or mpesa.rateUsd) to convert ${payment.currency} — no silent conversion.` };
  }
  const settlement = Math.round(payment.amount / rate);
  return { settlementAmount: settlement, settlementCurrency: cur, rate, sourceAmount: payment.amount, sourceCurrency: payment.currency };
}

/** Applies a VERIFIED provider success exactly once (idempotent). */
function applyProviderPaid(payment, { receipt, providerCode, providerDesc, at }) {
  if (payment.status === "PAID") return { already: true };
  if (receipt) {
    const dup = (db.data.payments || []).some(
      (q) => q._id !== payment._id && q.providerReceipt === receipt && q.status === "PAID",
    );
    if (dup) return { duplicate: true };
  }
  payment.status = "PAID";
  payment.providerReceipt = receipt || payment.providerReceipt || null;
  payment.providerResultCode = providerCode != null ? providerCode : payment.providerResultCode ?? null;
  payment.providerResultDesc = providerDesc || payment.providerResultDesc || "";
  payment.verifiedBy = "mpesa-callback";
  payment.paidAt = at || new Date().toISOString();
  payment.updatedAt = new Date().toISOString();
  db.persist();
  let ledger = null;
  let invoice = null;
  let shipment = null;
  if (payment.invoiceId) {
    const applied = applyPaymentToInvoice(payment);
    invoice = applied.invoice;
    shipment = applied.shipment;
    db.persist();
  } else if (payment.type === "TOPUP" || !payment.invoiceId) {
    ledger = addLedger({
      email: payment.customerEmail, type: "CREDIT", amount: payment.amount,
      currency: payment.currency || "USD",
      reason: `M-Pesa payment ${payment.paymentId}${receipt ? ` (receipt ${receipt})` : ""}`,
      refType: "payment", refId: payment._id, actor: "mpesa-callback",
    });
  }
  addAudit({ actorId: null, actorEmail: "mpesa-callback", actorRole: "provider", action: "PAYMENT_CONFIRMED", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, receipt, code: providerCode, description: String(providerDesc || "").slice(0, 200), invoiceId: invoice?.invoiceId || null, ledger: ledger?._id || null } });
  emailMember(payment.customerEmail, `M-Pesa payment ${payment.paymentId} confirmed`,
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2><p>Your M-Pesa payment of <strong>${payment.amount} ${payment.currency || "USD"}</strong> was confirmed${receipt ? ` (receipt ${receipt})` : ""}.${invoice ? ` Invoice ${invoice.invoiceId} settled.` : " Wallet credited."}</p></div>`);
  return { payment, ledger, invoice, shipment };
}

/**
 * POST /api/payments/mpesa/stk-push { paymentId, phoneNumber } — member
 * initiates a REAL M-Pesa STK push. Amount comes from the stored payment
 * record ONLY; the frontend can never influence it.
 */
router.post("/payments/mpesa/stk-push", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  if (!hitRate("mpesa:" + user._id, 5, 60000)) {
    return res.status(429).json({ message: "Too many M-Pesa requests — wait a minute and try again." });
  }
  const payment = (db.data.payments || []).find((x) => (x._id === req.body.paymentId || x.paymentId === req.body.paymentId) && x.customerEmail === user.email);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (payment.channel !== "MPESA") return res.status(409).json({ message: "This payment is not an M-Pesa payment." });
  if (!["PENDING", "EXPIRED", "FAILED"].includes(payment.status)) {
    return res.status(409).json({ message: `This payment is ${payment.status} — it cannot start a new M-Pesa request.` });
  }
  if (!mpesaConfigured()) {
    return res.status(503).json({ message: "M-Pesa is not fully configured yet (shortcode required). Try again later." });
  }
  const msisdn = normalizeMsisdn(String(req.body.phoneNumber || ""));
  if (!msisdn) return res.status(400).json({ message: "Enter a valid M-Pesa phone number (e.g. 0712XXXXXX or +2547XXXXXXXX)." });
  const settle = mpesaSettlement(payment);
  if (settle.error) return res.status(400).json({ message: settle.error });
  const accountRef = String(payment.paymentId || "SwiftKifisha").slice(0, 12);
  try {
    const pushed = await initiateStkPush({
      phoneNumber: msisdn,
      amount: settle.settlementAmount,
      accountReference: accountRef,
      transactionDesc: payment.type === "TOPUP" ? "Wallet topup" : "Shipping invoice",
    });
    payment.status = "PROCESSING";
    payment.provider = "MPESA";
    payment.providerRequestId = pushed.merchantRequestId || null;
    payment.checkoutRequestId = pushed.checkoutRequestId || null;
    payment.merchantRequestId = pushed.merchantRequestId || null;
    payment.providerResultCode = pushed.responseCode ?? null;
    payment.providerResultDesc = pushed.responseDescription || null;
    payment.phoneMasked = msisdn.slice(0, 6) + "****" + msisdn.slice(-2);
    payment.sourceAmount = settle.sourceAmount;
    payment.sourceCurrency = settle.sourceCurrency;
    payment.rate = settle.rate;
    payment.settlementAmount = settle.settlementAmount;
    payment.settlementCurrency = settle.settlementCurrency;
    payment.updatedAt = new Date().toISOString();
    db.persist();
    addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "STK_REQUEST_ACCEPTED", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, checkoutRequestId: payment.checkoutRequestId, responseCode: pushed.responseCode, settlementAmount: settle.settlementAmount, settlementCurrency: settle.settlementCurrency, phoneMasked: payment.phoneMasked } });
    return res.status(201).json({
      paymentId: payment.paymentId,
      status: "PROCESSING",
      message: "Check your phone and enter your M-Pesa PIN to complete the payment.",
      checkoutRequestId: payment.checkoutRequestId,
    });
  } catch (err) {
    console.error("[mpesa] stk push failed:", err?.message ?? err);
    return res.status(502).json({ message: "Unable to start the M-Pesa payment. Check your phone number and try again." });
  }
}));

/**
 * POST /api/payments/mpesa/callback — PUBLIC Daraja callback URL.
 * Configure this exact URL as MPESA_CALLBACK_URL. Verified by
 * CheckoutRequestID + amount + receipt; idempotent by design.
 */
router.post("/payments/mpesa/callback", ah(async (req, res) => {
  const parsed = parseStkCallback(req.body);
  if (!parsed) return res.status(400).json({ message: "Unrecognized callback payload." });
  const payment = (db.data.payments || []).find((x) => x.checkoutRequestId === parsed.checkoutRequestId);
  // Always ACK quickly so Daraja stops retrying; unknown callbacks are logged.
  if (!payment) {
    console.warn(`[mpesa] callback for unknown checkout ${parsed.checkoutRequestId} ignored.`);
    return res.json({ ResultCode: 0, ResultDesc: "Success" });
  }
  const target = parsed.resultCode === 0 ? "PAID" : MPESA_RESULT_MAP[parsed.resultCode] || "FAILED";
  payment.providerResultCode = parsed.resultCode;
  payment.providerResultDesc = String(parsed.resultDesc || "").slice(0, 300);
  payment.providerReceipt = parsed.receiptNumber || payment.providerReceipt || null;
  payment.updatedAt = new Date().toISOString();
  addAudit({ actorId: null, actorEmail: "mpesa-callback", actorRole: "provider", action: "CALLBACK_RECEIVED", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, checkoutRequestId: parsed.checkoutRequestId, resultCode: parsed.resultCode, resultDesc: String(parsed.resultDesc || "").slice(0, 200), receipt: parsed.receiptNumber } });
  if (target === "PAID") {
    const expected = payment.settlementAmount ?? Math.round(payment.amount);
    if (parsed.amount != null && parsed.amount !== expected) {
      payment.status = "FAILED";
      payment.providerResultDesc = `${payment.providerResultDesc || ""} Amount mismatch (expected ${expected} ${payment.settlementCurrency || ""}, got ${parsed.amount}).`;
      db.persist();
      addAudit({ actorId: null, actorEmail: "mpesa-callback", actorRole: "provider", action: "PAYMENT_FAILED", entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, reason: "amount mismatch" } });
      return res.json({ ResultCode: 0, ResultDesc: "Success" });
    }
    applyProviderPaid(payment, { receipt: parsed.receiptNumber, providerCode: 0, providerDesc: parsed.resultDesc, at: new Date().toISOString() });
  } else {
    payment.status = target; // CANCELLED | EXPIRED | FAILED (provider code preserved)
    payment.updatedAt = new Date().toISOString();
    db.persist();
    addAudit({ actorId: null, actorEmail: "mpesa-callback", actorRole: "provider", action: `PAYMENT_${target}`, entity: "payment", entityId: payment._id, changes: { paymentId: payment.paymentId, resultCode: parsed.resultCode, resultDesc: String(parsed.resultDesc || "").slice(0, 200) } });
  }
  return res.json({ ResultCode: 0, ResultDesc: "Success" });
}));

/** POST /api/payments/:id/refresh — owner-triggered Daraja status query (throttled). */
router.post("/payments/:id/refresh", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const payment = (db.data.payments || []).find((x) => (x._id === req.params.id || x.paymentId === req.params.id) && x.customerEmail === user.email);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (payment.provider !== "MPESA" || !payment.checkoutRequestId || !["PENDING", "PROCESSING"].includes(payment.status)) {
    return res.status(409).json({ message: "This payment cannot be refreshed." });
  }
  const last = mpesaRefreshAt.get(payment._id) || 0;
  if (Date.now() - last < 20000) return res.status(429).json({ message: "Wait a few seconds before refreshing." });
  mpesaRefreshAt.set(payment._id, Date.now());
  try {
    const raw = await queryStkStatus({ checkoutRequestId: payment.checkoutRequestId });
    const parsed = parseStkCallback(raw);
    if (!parsed) return res.json({ paymentId: payment.paymentId, status: payment.status, message: "No update yet — still waiting for confirmation." });
    if (parsed.resultCode === 0) {
      applyProviderPaid(payment, { receipt: parsed.receiptNumber, providerCode: 0, providerDesc: parsed.resultDesc, at: new Date().toISOString() });
      return res.json({ paymentId: payment.paymentId, status: "PAID", message: "Payment confirmed." });
    }
    const target = MPESA_RESULT_MAP[parsed.resultCode] || "FAILED";
    payment.status = target;
    payment.providerResultCode = parsed.resultCode;
    payment.providerResultDesc = String(parsed.resultDesc || "").slice(0, 300);
    payment.updatedAt = new Date().toISOString();
    db.persist();
    return res.json({ paymentId: payment.paymentId, status: target, message: parsed.resultDesc || "No update yet." });
  } catch (err) {
    console.error("[mpesa] refresh failed:", err?.message ?? err);
    return res.status(502).json({ message: "M-Pesa is not responding right now — we are still waiting for confirmation." });
  }
}));

/* ------------------------------ provider webhooks (prepared) ------------------------------ */

/**
 * POST /api/payments/webhooks/:provider — carrier-of-money webhook intake.
 * While a provider has no credentials this answers 503 with the prepared
 * message. When credentials exist, signature verification + idempotent event
 * handling plug in here; unverified events are never applied.
 */
router.post("/payments/webhooks/:provider", ah(async (req, res) => {
  const code = String(req.params.provider || "").toUpperCase();
  if (!PROVIDER_BY_CODE[code]) return res.status(404).json({ message: "Unknown provider." });
  const raw = JSON.stringify(req.body || {});
  try {
    const verified = await verifyProviderWebhook(code, raw, req.headers);
    return res.json({ ok: true, received: hashEvent(code, raw), event: verified });
  } catch (err) {
    const message = err?.message || "Webhook rejected.";
    if (err?.code) console.log(`[webhook] ${code}: ${message}`);
    const status = err?.statusCode === 503 ? 503 : 400;
    return res.status(status).json({ message });
  }
}));

/** POST /api/admin/providers/mpesa/test-connection — finance connectivity check (no charges). */
router.post("/admin/providers/mpesa/test-connection", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const result = await testDarajaConnection();
  return res.json({ message: result.configured ? "Test finished — see results." : "M-Pesa credentials are not fully configured.", ...result });
}));

export default router;
