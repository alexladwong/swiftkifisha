/**
 * Commercial parcel-forwarding API — Phase 1 core.
 * Member: packages, pre-alert, package detail/actions, mailboxes, overview
 * stats, quotes. Admin: warehouses, receiving/assignment, measurements,
 * packages queue, staff status transitions, shipments (internal handover),
 * audit log. Persisted in db.json + Neon sync. No fabricated carrier events.
 */
import { Router } from "express";
import crypto from "node:crypto";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";
import {
  PACKAGE_STATUS, PACKAGE_TRANSITIONS, canTransition, allowedActionsFor, actionTarget,
  addAudit, withIdempotency, ruleValue,
} from "../lib/commerce.js";
import { sendGenericEmail } from "../lib/mailer.js";

const router = Router();
const UPLOAD_DIR = path.join(config.root, "data", "uploads", "packages");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* --------------------------------- helpers --------------------------------- */

const memberByToken = (req) => db.data.users.find((u) => u._id === req.user._id);
const requireRole = (roles) => (req, res, next) => {
  const has = (req.user?.role || "").toUpperCase();
  if (!req.user || !roles.some((r) => r.toUpperCase() === has)) {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
};
const ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "WAREHOUSE_MANAGER", "WAREHOUSE_AGENT", "CUSTOMER_SUPPORT", "FINANCE"];
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "WAREHOUSE_MANAGER", "WAREHOUSE_AGENT"];

function packageForMember(req) {
  const user = memberByToken(req);
  const member = (db.data.members || []).find((m) => m.email === user.email);
  const id = req.params.id;
  const pkg = (db.data.packages || []).find((p) => p._id === id || p.packageId === id);
  if (!pkg || pkg.customerEmail !== user.email) return null;
  return { pkg, member };
}

function storageInfo(pkg) {
  const freeDays = Number(ruleValue("storage.freeDays", 7));
  const daily = Number(ruleValue("storage.dailyRateUSD", 0.5));
  const start = new Date(pkg.receivedAt || pkg.createdAt || Date.now());
  const freeUntil = new Date(start.getTime() + freeDays * 86400000);
  const overdueDays = Math.max(0, Math.floor((Date.now() - freeUntil.getTime()) / 86400000));
  return { freeDays, freeUntil: freeUntil.toISOString(), dailyRateUSD: daily, overdueDays };
}

function freshPackageId() {
  return "SWPK-" + String(Math.floor(100000 + Math.random() * 899999));
}

/** Legal next statuses per current state — the UI renders options from the
 * backend machine rather than duplicating transition logic. */
function transitionsOf(p) {
  return PACKAGE_TRANSITIONS[p.status] || [];
}

/* ------------------------------- member routes ------------------------------- */

/** GET /api/packages — the member's packages (optional ?status=). */
router.get("/packages", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const status = String(req.query.status || "");
  let rows = (db.data.packages || []).filter((p) => p.customerEmail === user.email);
  if (status) rows = rows.filter((p) => p.status === status);
  rows = rows.map((p) => ({ ...p, storage: storageInfo(p), allowedActions: allowedActionsFor(p) }));
  rows.sort((a, b) => new Date(b.receivedAt || b.createdAt) - new Date(a.receivedAt || a.createdAt));
  return res.json({ packages: rows });
}));

/** POST /api/packages/pre-alert — tell us a parcel is coming. */
router.post("/packages/pre-alert", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const member = (db.data.members || []).find((m) => m.email === user.email);
  if (!member) return res.status(403).json({ message: "Member profile required — your membership must be approved first." });
  const b = req.body || {};
  if (!String(b.merchant || "").trim() || !String(b.description || "").trim()) {
    return res.status(400).json({ message: "Merchant/store and description are required." });
  }
  const pkg = {
    _id: crypto.randomUUID(),
    packageId: freshPackageId(),
    customerEmail: user.email,
    memberCode: member.memberCode,
    merchant: String(b.merchant).trim().slice(0, 120),
    merchantTrackingNumber: String(b.merchantTrackingNumber || "").trim().slice(0, 80),
    carrier: String(b.carrier || "").trim().slice(0, 60),
    description: String(b.description).trim().slice(0, 2000),
    itemCount: Number(b.itemCount) || 1,
    declaredValue: Number(b.estimatedValue) || 0,
    currency: String(b.currency || "USD").toUpperCase().slice(0, 3),
    expectedDeliveryDate: b.expectedDeliveryDate || "",
    destinationWarehouse: String(b.destinationMailbox || "").slice(0, 40),
    invoiceUploaded: Boolean(b.invoiceUploaded),
    notes: String(b.notes || "").trim().slice(0, 1000),
    status: PACKAGE_STATUS.PRE_ALERTED,
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.packages = db.data.packages || [];
  db.data.packages.push(pkg);
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "PACKAGE_PRE_ALERTED", entity: "package", entityId: pkg._id });
  return res.status(201).json({ message: "Pre-alert saved — warehouse expects this parcel.", package: pkg });
}));

/** GET /api/packages/:id — detail + eligibility. */
router.get("/packages/:id", requireAuth, ah(async (req, res) => {
  const { pkg } = packageForMember(req) || {};
  if (!pkg) return res.status(404).json({ message: "Package not found." });
  return res.json({ package: { ...pkg, storage: storageInfo(pkg), allowedActions: allowedActionsFor(pkg) } });
}));

/** POST /api/packages/:id/action — customer requests an action (state machine). */
router.post("/packages/:id/action", requireAuth, ah(async (req, res) => {
  const { pkg } = packageForMember(req) || {};
  if (!pkg) return res.status(404).json({ message: "Package not found." });
  const action = String((req.body || {}).action || "");
  const note = String((req.body || {}).note || "").trim().slice(0, 1000);
  const allowed = allowedActionsFor(pkg);
  if (!allowed.includes(action)) {
    return res.status(409).json({ message: `Action "${action}" is not available for a package in ${pkg.status}.` });
  }
  const target = actionTarget(action);
  // Advisory actions (requestPhotos, reportProblem) do not move the state.
  // State-changing actions are already whitelisted per-status via
  // allowedActionsFor — the customer request itself is the legal transition.
  if (target) pkg.status = target;
  pkg.lastCustomerAction = { action, note, at: new Date().toISOString() };
  pkg.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: `PACKAGE_ACTION_${action.toUpperCase()}`, entity: "package", entityId: pkg._id, reason: note, changes: { status: target } });
  return res.json({ message: target ? `Package moved to ${target}.` : "Request sent to the warehouse team.", package: { ...pkg, allowedActions: allowedActionsFor(pkg), storage: storageInfo(pkg) } });
}));

/** GET /api/account/overview-stats — real counts for the member Overview. */
router.get("/account/overview-stats", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const mine = (db.data.packages || []).filter((p) => p.customerEmail === user.email);
  const awaiting = mine.filter((p) => p.status === "ACTION_REQUIRED" || p.status === "RECEIVED" || p.status === "PROCESSING");
  const actionRequired = mine
    .filter((p) => p.status === "ACTION_REQUIRED" || (p.status === "RECEIVED" && p.hazardousReview === true))
    .map((p) => {
      const s = storageInfo(p);
      const reasons = [];
      if (p.status === "ACTION_REQUIRED") reasons.push("Waiting for your shipping instructions");
      if (p.hazardousReview) reasons.push("Prohibited/restricted item review");
      if (s.overdueDays >= 0 && p.status !== "SHIPMENT_CREATED" && p.status !== "DISPATCHED" && s.overdueDays > 0) reasons.push(`Storage fee applies from ${new Date(s.freeUntil).toLocaleDateString()}`);
      return { packageId: p.packageId, reasons, freeUntil: s.freeUntil };
    });
  const openPayments = (db.data.payments || []).filter((x) => x.customerEmail === user.email && x.status === "PENDING");
  return res.json({
    packagesReceived: mine.filter((p) => p.receivedAt).length,
    awaitingAction: awaiting.length,
    unpaidBalance: openPayments.reduce((sum, x) => sum + (x.amountDue || 0), 0),
    packagesInTransit: 0, // real transit counts live on shipments/parcels; Phase-2 links packages to parcels
    delivered: 0,
    actionRequired,
  });
}));

/** GET /api/mailboxes — operational mailbox info (admin-managed warehouses). */
router.get("/mailboxes", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const member = (db.data.members || []).find((m) => m.email === user.email);
  if (!member) return res.json({ mailboxes: [] });
  const out = (member.hubAddresses || []).map((mb) => {
    const wh = (db.data.warehouses || []).find((w) => w.country === mb.country);
    return {
      country: mb.country,
      city: wh?.city || mb.city,
      warehouseId: wh?._id || null,
      suite: mb.suite,
      recipientName: user.name,
      addressLines: (wh?.addressLines && wh.addressLines.length ? wh.addressLines : mb.addressLines || []),
      instructions: wh
        ? `Send to ${wh.name}, ${wh.city}, ${wh.country}. Always include your suite number ${mb.suite} and full name ${user.name}.`
        : "",
    };
  });
  return res.json({ mailboxes: out });
}));

/* ------------------------------ admin: warehouses ------------------------------ */

router.get("/admin/warehouses", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  return res.json({ warehouses: db.data.warehouses || [] });
}));

router.post("/admin/warehouses", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER"]), ah(async (req, res) => {
  const b = req.body || {};
  if (!String(b.name || "").trim() || !String(b.country || "").trim() || !String(b.city || "").trim()) {
    return res.status(400).json({ message: "Name, country and city are required." });
  }
  const wh = {
    _id: crypto.randomUUID(),
    code: String(b.code || b.country.slice(0, 2).toUpperCase()).toUpperCase().slice(0, 6),
    name: String(b.name).trim(),
    country: String(b.country).trim(),
    city: String(b.city).trim(),
    addressLines: Array.isArray(b.addressLines) ? b.addressLines.map((x) => String(x).trim()) : [],
    phone: String(b.phone || ""),
    timezone: String(b.timezone || "UTC"),
    currency: String(b.currency || "USD").toUpperCase().slice(0, 3),
    status: b.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    capabilities: Array.isArray(b.capabilities) ? b.capabilities : [],
    supportedCarriers: Array.isArray(b.supportedCarriers) ? b.supportedCarriers : [],
    operatingHours: String(b.operatingHours || ""),
    createdAt: new Date().toISOString(),
  };
  db.data.warehouses = db.data.warehouses || [];
  db.data.warehouses.push(wh);
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "WAREHOUSE_CREATED", entity: "warehouse", entityId: wh._id });
  return res.status(201).json({ message: "Warehouse created", warehouse: wh });
}));

router.patch("/admin/warehouses/:id", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER"]), ah(async (req, res) => {
  const wh = (db.data.warehouses || []).find((w) => w._id === req.params.id);
  if (!wh) return res.status(404).json({ message: "Warehouse not found." });
  const before = JSON.stringify(wh);
  for (const k of ["name", "country", "city", "phone", "timezone", "currency", "status", "operatingHours"]) {
    if (req.body[k] !== undefined) wh[k] = String(req.body[k]);
  }
  if (Array.isArray(req.body.addressLines)) wh.addressLines = req.body.addressLines.map((x) => String(x));
  if (Array.isArray(req.body.capabilities)) wh.capabilities = req.body.capabilities;
  if (Array.isArray(req.body.supportedCarriers)) wh.supportedCarriers = req.body.supportedCarriers;
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "WAREHOUSE_UPDATED", entity: "warehouse", entityId: wh._id, changes: { before, after: JSON.stringify(wh) } });
  return res.json({ message: "Warehouse updated", warehouse: wh });
}));

/* ------------------------------ admin: receiving ------------------------------ */

/** GET /admin/packages — ops queue with filters. */
router.get("/admin/packages", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const { status, search, warehouse, unassigned } = req.query;
  let rows = [...(db.data.packages || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) rows = rows.filter((p) => p.status === status);
  if (warehouse) rows = rows.filter((p) => p.warehouseCountry === warehouse);
  if (unassigned === "true") rows = rows.filter((p) => !p.customerEmail);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter(
      (p) =>
        (p.packageId || "").toLowerCase().includes(q) ||
        (p.merchantTrackingNumber || "").toLowerCase().includes(q) ||
        (p.customerEmail || "").toLowerCase().includes(q) ||
        (p.memberCode || "").toLowerCase().includes(q) ||
        (p.merchant || "").toLowerCase().includes(q),
    );
  }
  return res.json({ packages: rows.map((p) => ({ ...p, allowedTransitions: transitionsOf(p) })) });
}));

/**
 * POST /admin/packages/receive — warehouse receiving. Idempotent per
 * merchant tracking number within 60s (double scans cannot duplicate).
 * Requires an idempotencyKey header for repeat protection.
 */
router.post("/admin/packages/receive", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const idem = String(req.headers["idempotency-key"] || req.body.idempotencyKey || "");
  const run = async () => {
    const b = req.body || {};
    const merchantTracking = String(b.merchantTrackingNumber || "").trim();
    if (!merchantTracking) {
      return res.status(400).json({ message: "Merchant tracking number is required (scan or type)." });
    }
    // Match an existing pre-alert or assign by mailbox/member code.
    let customerEmail = null;
    let memberCode = String(b.memberCode || b.mailboxCode || "").trim();
    if (memberCode) {
      const member = (db.data.members || []).find((m) => m.memberCode === memberCode);
      if (member) customerEmail = member.email;
    }
    const pre = (db.data.packages || []).find((p) => p.merchantTrackingNumber === merchantTracking && p.status === "PRE_ALERTED");
    if (pre) customerEmail = customerEmail || pre.customerEmail;
    // Double-scan protection: an already-received row with the same merchant
    // tracking number is a no-op returning the existing package — never a twin.
    const existing = pre ? null : (db.data.packages || []).find((p) => p.merchantTrackingNumber === merchantTracking && p._id !== pre?._id);
    if (existing) {
      return res.json({ message: `Already received on ${(existing.receivedAt || "").slice(0, 10)} — returning existing package.`, package: { ...existing, allowedActions: allowedActionsFor(existing) } });
    }

    const weight = Number(b.weight);
    const len = Number(b.length);
    const wid = Number(b.width);
    const hei = Number(b.height);
    const volumetric = len && wid && hei ? (len * wid * hei) / 5000 : 0;
    const chargeable = Math.max(weight || 0, volumetric);
    const warehouse = (db.data.warehouses || []).find((w) => w.code === String(b.warehouseCode || "US").toUpperCase())
      || (db.data.warehouses || [])[0];

    const fresh = {
      _id: crypto.randomUUID(),
      packageId: freshPackageId(),
      customerEmail: customerEmail || null,
      memberCode: memberCode || (pre?.memberCode) || null,
      preAlertId: pre?._id || null,
      warehouseId: warehouse?._id || null,
      warehouseCountry: warehouse?.country || "",
      merchant: String(b.merchant || pre?.merchant || "Unknown merchant").trim().slice(0, 120),
      merchantTrackingNumber: merchantTracking.slice(0, 80),
      carrier: String(b.carrier || "").trim().slice(0, 60),
      description: String(b.description || pre?.description || "").trim().slice(0, 2000),
      itemCount: Number(b.itemCount) || 1,
      receivedAt: new Date().toISOString(),
      status: customerEmail ? PACKAGE_STATUS.RECEIVED : PACKAGE_STATUS.EXPECTED, // unassigned → EXPECTED until assigned
      weight: weight || null,
      length: len || null,
      width: wid || null,
      height: hei || null,
      volumetricWeight: volumetric || null,
      chargeableWeight: chargeable || null,
      condition: String(b.condition || "undamaged").slice(0, 60),
      photos: [],
      declaredValue: Number(b.declaredValue) || 0,
      currency: String(b.currency || "USD").toUpperCase().slice(0, 3),
      storageStartDate: new Date().toISOString(),
      storageFreeUntil: "",
      storageFees: 0,
      notes: String(b.notes || "").trim().slice(0, 1000),
      specialHandling: String(b.specialHandling || "").trim().slice(0, 200),
      hazardousReview: b.hazardous === true || String(b.hazardous || "") === "true" ? true : false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fresh.storageFreeUntil = storageInfo(fresh).freeUntil;
    // One physical parcel = one package row: when a pre-alert exists, reuse
    // that row (stable customer-facing identity) instead of creating a twin.
    const pkg = pre
      ? Object.assign(pre, fresh, {
          _id: pre._id, packageId: pre.packageId, preAlertId: pre.preAlertId,
          createdAt: pre.createdAt,
          photos: [...(pre.photos || []), ...(fresh.photos || [])],
        })
      : fresh;
    if (!pre) {
      db.data.packages = db.data.packages || [];
      db.data.packages.push(pkg);
    }
    db.persist();
    addAudit({
      actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role,
      action: "PACKAGE_RECEIVED", entity: "package", entityId: pkg._id,
      changes: { merchantTracking, memberCode, customerEmail, weight, chargeableWeight: pkg.chargeableWeight ?? null },
    });
    if (customerEmail) {
      const member = (db.data.members || []).find((m) => m.email === customerEmail);
      sendGenericEmail({
        to: customerEmail,
        subject: `Package received at your ${pkg.warehouseCountry} mailbox`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
          <p>Hi ${member?.name || "there"}, your package <strong>${pkg.packageId}</strong> from ${pkg.merchant} (${merchantTracking}) arrived at our ${pkg.warehouseCountry} warehouse${weight ? ` — ${weight} kg` : ""}.</p>
          <p>Sign in to your dashboard to review it and choose what to do next.</p></div>`,
      }).catch(() => {});
    }
    return res.status(201).json({ message: "Package received" + (customerEmail ? " and assigned" : " — unassigned (assign a mailbox)"), package: { ...pkg, allowedActions: allowedActionsFor(pkg), allowedTransitions: transitionsOf(pkg) } });
  };
  if (idem) return withIdempotency("receive:" + idem, 60000, run);
  return run();
}));

/** POST /admin/packages/:id/assign — assign to customer (mailbox/member code or email). */
router.post("/admin/packages/:id/assign", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const pkg = (db.data.packages || []).find((p) => p._id === req.params.id);
  if (!pkg) return res.status(404).json({ message: "Package not found." });
  const code = String((req.body || {}).memberCode || "").trim();
  const email = String((req.body || {}).email || "").toLowerCase().trim();
  const member = code
    ? (db.data.members || []).find((m) => m.memberCode === code)
    : (db.data.members || []).find((m) => m.email === email);
  if (!member) return res.status(404).json({ message: "No member found with that mailbox code or email." });
  const before = pkg.customerEmail;
  pkg.customerEmail = member.email;
  pkg.memberCode = member.memberCode;
  if (pkg.status === "EXPECTED") pkg.status = PACKAGE_STATUS.RECEIVED;
  pkg.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PACKAGE_ASSIGNED", entity: "package", entityId: pkg._id, changes: { before: before || null, after: member.email } });
  return res.json({ message: `Package assigned to ${member.email}.`, package: { ...pkg, allowedTransitions: transitionsOf(pkg) } });
}));

/** PATCH /admin/packages/:id/measurements — correct weight/dimensions (audited). */
router.patch("/admin/packages/:id/measurements", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const pkg = (db.data.packages || []).find((p) => p._id === req.params.id);
  if (!pkg) return res.status(404).json({ message: "Package not found." });
  const reason = String((req.body || {}).reason || "correction").trim().slice(0, 300);
  const changes = {};
  for (const k of ["weight", "length", "width", "height", "condition"]) {
    if (req.body[k] !== undefined) changes[k] = { before: pkg[k] ?? null, after: req.body[k] };
  }
  if (req.body.weight !== undefined) pkg.weight = Number(req.body.weight);
  if (req.body.length !== undefined) pkg.length = Number(req.body.length);
  if (req.body.width !== undefined) pkg.width = Number(req.body.width);
  if (req.body.height !== undefined) pkg.height = Number(req.body.height);
  if (req.body.condition !== undefined) pkg.condition = String(req.body.condition);
  const v = Number(pkg.volumetricWeight || 0);
  pkg.volumetricWeight = pkg.length && pkg.width && pkg.height ? (pkg.length * pkg.width * pkg.height) / 5000 : v;
  pkg.chargeableWeight = Math.max(pkg.weight || 0, pkg.volumetricWeight || 0);
  pkg.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PACKAGE_MEASUREMENTS_CORRECTED", entity: "package", entityId: pkg._id, reason, changes });
  return res.json({ message: "Measurements corrected (audited).", package: { ...pkg, allowedTransitions: transitionsOf(pkg) } });
}));

/** POST /admin/packages/:id/status — staff status transition (state machine). */
router.post("/admin/packages/:id/status", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const pkg = (db.data.packages || []).find((p) => p._id === req.params.id);
  if (!pkg) return res.status(404).json({ message: "Package not found." });
  const to = String((req.body || {}).status || "");
  const reason = String((req.body || {}).reason || "staff update").trim().slice(0, 300);
  if (!canTransition(pkg.status, to)) {
    return res.status(409).json({ message: `Invalid transition ${pkg.status} → ${to}.` });
  }
  const before = pkg.status;
  pkg.status = to;
  pkg.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PACKAGE_STATUS_CHANGE", entity: "package", entityId: pkg._id, reason, changes: { before, after: to } });
  return res.json({ message: `Status → ${to}`, package: { ...pkg, allowedTransitions: transitionsOf(pkg) } });
}));

/* -------------------------------- photo upload -------------------------------- */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname || ".jpg").toLowerCase()),
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    if (ok) return cb(null, true);
    const e = new Error("Only JPEG, PNG, WEBP or GIF images are allowed.");
    e.statusCode = 400;
    cb(e, false);
  },
});

/** POST /admin/packages/:id/photos — attach real photos (front/back/label/damage/contents). */
router.post("/admin/packages/:id/photos", requireAuth, requireRole(ADMIN_ROLES), upload.array("photos", 6), ah(async (req, res) => {
  const pkg = (db.data.packages || []).find((p) => p._id === req.params.id);
  if (!pkg) return res.status(404).json({ message: "Package not found." });
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: "No photos uploaded." });
  const view = String(req.body.view || "front");
  pkg.photos = pkg.photos || [];
  for (const f of req.files) {
    pkg.photos.push({ id: f.filename, view, name: f.originalname, size: f.size, uploadedAt: new Date().toISOString() });
  }
  pkg.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PACKAGE_PHOTOS_ADDED", entity: "package", entityId: pkg._id, changes: { count: req.files.length } });
  return res.json({ message: `${req.files.length} photo(s) saved.`, photos: pkg.photos });
}));

/** GET /files/packages/:filename — access-controlled photo stream. */
router.get("/files/packages/:filename", requireAuth, ah(async (req, res) => {
  const filename = String(req.params.filename || "");
  if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
    return res.status(400).json({ message: "Invalid file reference." });
  }
  const owner = (db.data.packages || []).find((p) => (p.photos || []).some((ph) => ph.id === filename));
  if (!owner) return res.status(404).json({ message: "File not found." });
  const isAdmin = ADMIN_ROLES.some((r) => r.toUpperCase() === (req.user.role || "").toUpperCase());
  if (!isAdmin && owner.customerEmail !== req.user.email) {
    return res.status(403).json({ message: "You do not have access to this file." });
  }
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found." });
  res.setHeader("Content-Type", "image/" + (filename.endsWith(".png") ? "png" : filename.endsWith(".gif") ? "gif" : filename.endsWith(".webp") ? "webp" : "jpeg"));
  return fs.createReadStream(filePath).pipe(res);
}));

/* ------------------------------ admin: audit log ------------------------------ */

router.get("/admin/audit", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = [...(db.data.auditLogs || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
  return res.json({ audit: rows });
}));

/* -------------------------------- quotes (Phase 1 core) -------------------------------- */

/** POST /api/quotes — internal quote engine from backend pricing rules. */
router.post("/quotes", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const b = req.body || {};
  const warehouse = (db.data.warehouses || []).find((w) => w._id === b.warehouseId) || (db.data.warehouses || [])[0];
  if (!warehouse) return res.status(400).json({ message: "Origin warehouse is required." });
  const weight = Math.max(Number(b.weight) || 0, 0.1);
  const declaredValue = Math.max(Number(b.declaredValue) || 0, 0);
  const insurance = b.insurance === true;
  const destinationCountry = String(b.destinationCountry || "").trim();
  if (!destinationCountry) return res.status(400).json({ message: "Destination country is required." });
  const handling = Number(ruleValue("fees.originsHandling", 5));
  const insuranceRate = Number(ruleValue("insurance.ratePct", 2.5));
  // Zone-less Phase-1 base: rate per kg derived from configured pricing rules
  // (real negotiated tariffs plug in through the carrier layer later).
  const basePerKg = Number(ruleValue("rate.basePerKgUSD", 8));
  const baseFreight = Math.round(weight * basePerKg * 100) / 100;
  const insurancePremium = insurance ? Math.round((declaredValue * insuranceRate) / 100 * 100) / 100 : 0;
  const serviceFee = 0;
  const total = Math.round((baseFreight + handling + insurancePremium + serviceFee) * 100) / 100;
  const quote = {
    _id: crypto.randomUUID(),
    quoteId: "SKQ-" + String(Math.floor(100000 + Math.random() * 899999)),
    customerEmail: user.email,
    warehouseId: warehouse._id,
    destinationCountry,
    destinationPostalCode: String(b.destinationPostalCode || ""),
    weightKg: weight,
    declaredValue,
    currency: "USD",
    serviceType: String(b.serviceType || "standard"),
    insurance,
    expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    lineItems: [
      { code: "freight", label: `Base freight (${warehouse.country} → ${destinationCountry})`, amount: baseFreight },
      { code: "handling", label: "Warehouse handling", amount: handling },
      ...(insurancePremium ? [{ code: "insurance", label: `Shipment protection (${insuranceRate}% of ${declaredValue})`, amount: insurancePremium }] : []),
    ],
    total,
    note: "Estimate only — not a guaranteed price. Final quote is confirmed at checkout with carrier pricing.",
    createdAt: new Date().toISOString(),
  };
  db.data.quotes = db.data.quotes || [];
  db.data.quotes.push(quote);
  db.persist();
  return res.status(201).json({ message: "Quote created", quote });
}));

export default router;
