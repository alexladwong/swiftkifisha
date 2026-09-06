/**
 * Phase-3 international workflows: customs declarations, consolidation
 * requests, restricted-item advisory. Backend is the source of truth for
 * statuses; every mutation is audited; no invented legal requirements.
 * Mounted at /api (collections `declarations`, `consolidations`).
 */
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { addAudit } from "../lib/commerce.js";
import { sendGenericEmail } from "../lib/mailer.js";

const router = Router();
const memberByToken = (req) => db.data.users.find((u) => u._id === req.user._id);
const memberRow = (user) => (db.data.members || []).find((m) => m.email === user.email);
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "WAREHOUSE_MANAGER", "WAREHOUSE_AGENT", "CUSTOMER_SUPPORT", "FINANCE"];
const requireRole = (roles) => (req, res, next) => {
  const has = (req.user?.role || "").toUpperCase();
  if (!req.user || !roles.some((r) => r.toUpperCase() === has)) return res.status(403).json({ message: "Admin access required." });
  return next();
};
const WEB_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

/* Advisory only — exact rules are configurable per origin/destination/carrier
 * in later phases; never pretend these are identical everywhere. */
const RESTRICTED_CATEGORIES = [
  { code: "FLAMMABLES", label: "Flammables / aerosols", note: "Usually prohibited by air carriers and many routes." },
  { code: "EXPLOSIVES", label: "Explosives / fireworks", note: "Prohibited on nearly all commercial routes." },
  { code: "WEAPONS", label: "Weapons / ammunition", note: "Heavily regulated — usually unavailable." },
  { code: "BATTERIES", label: "Loose lithium batteries", note: "Restricted by IATA-style rules; carrier-specific." },
  { code: "CHEMICALS", label: "Dangerous chemicals", note: "Requires dangerous-goods handling when allowed." },
  { code: "DRUGS", label: "Illegal drugs / substances", note: "Prohibited." },
  { code: "COUNTERFEIT", label: "Counterfeit goods", note: "Prohibited; customs may confiscate." },
  { code: "MEDICINE", label: "Restricted medicines", note: "Prescription controls differ by country." },
  { code: "CURRENCY", label: "Currency / bearer instruments", note: "Regulated — usually unavailable." },
  { code: "FOOD_PLANTS", label: "Certain foods / plants", note: "Subject to import controls at destination." },
];

/** Packages that may be declared/consolidated (not yet dispatched/terminal). */
const WORKABLE = ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "REPACKING", "CONSOLIDATION_PENDING", "HOLD", "EXCEPTION"];

/* ------------------------------ member: customs ------------------------------ */

/** POST /api/customs — declaration for packages about to ship (values validated, no under-declaration nudges). */
router.post("/customs", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const b = req.body || {};
  const ids = Array.isArray(b.packageIds) ? b.packageIds.map(String) : [];
  if (ids.length === 0) return res.status(400).json({ message: "Choose at least one package." });
  const pkgs = ids.map((id) => (db.data.packages || []).find((p) => p._id === id || p.packageId === id)).filter(Boolean);
  if (pkgs.length !== ids.length) return res.status(404).json({ message: "One or more packages were not found." });
  for (const p of pkgs) {
    if (p.customerEmail !== user.email) return res.status(403).json({ message: `Package ${p.packageId} is not yours.` });
    if (!WORKABLE.includes(p.status)) return res.status(409).json({ message: `Package ${p.packageId} is ${p.status} — declarations need packages that are still being prepared.` });
  }
  const purpose = String(b.purpose || "personal").trim().slice(0, 40);
  if (!["personal", "gift", "sale", "documents", "return"].includes(purpose)) {
    return res.status(400).json({ message: "Purpose must be personal, gift, sale, documents or return." });
  }
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return res.status(400).json({ message: "Describe at least one item honestly (description, quantity, unit value, country of origin)." });
  const cleanItems = [];
  for (const it of items) {
    const description = String(it.description || "").trim().slice(0, 300);
    const countryOfOrigin = String(it.countryOfOrigin || "").trim().slice(0, 80);
    const quantity = Number(it.quantity);
    const unitValue = Number(it.unitValue);
    if (!description || !countryOfOrigin || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitValue) || unitValue <= 0) {
      return res.status(400).json({ message: "Every item needs a description, a country of origin, a positive quantity and a positive unit value." });
    }
    cleanItems.push({
      description,
      quantity,
      unitValue: Math.round(unitValue * 100) / 100,
      hsCode: String(it.hsCode || "").trim().slice(0, 20),
      note: String(it.note || "").trim().slice(0, 300),
    });
  }
  const totalValue = Math.round(cleanItems.reduce((s, i) => s + i.quantity * i.unitValue, 0) * 100) / 100;
  const row = {
    _id: crypto.randomUUID(),
    declarationId: "SKD-" + String(Math.floor(100000 + Math.random() * 899999)),
    customerEmail: user.email,
    packageIds: pkgs.map((p) => p._id),
    packageRefs: pkgs.map((p) => p.packageId),
    purpose,
    items: cleanItems,
    currency: String(b.currency || "USD").toUpperCase().slice(0, 3),
    totalValue,
    status: "SUBMITTED",
    flagged: false,
    reviewNote: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.declarations = db.data.declarations || [];
  db.data.declarations.push(row);
  for (const p of pkgs) {
    p.customsDeclarationId = row._id;
    p.updatedAt = new Date().toISOString();
  }
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "CUSTOMS_DECLARED", entity: "declaration", entityId: row._id, changes: { declarationId: row.declarationId, packages: row.packageRefs, purpose, totalValue, itemCount: cleanItems.length } });
  return res.status(201).json({ message: "Customs declaration submitted for review.", declaration: row });
}));

/** GET /api/customs/me — my declarations (newest first). */
router.get("/customs/me", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const rows = (db.data.declarations || []).filter((d) => d.customerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ declarations: rows });
}));

/** GET /api/customs/:id — own declaration detail. */
router.get("/customs/:id", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const row = (db.data.declarations || []).find((d) => (d._id === req.params.id || d.declarationId === req.params.id) && d.customerEmail === user.email);
  if (!row) return res.status(404).json({ message: "Declaration not found." });
  return res.json({ declaration: row });
}));

/* ------------------------------ member: consolidation ------------------------------ */

/** POST /api/consolidations — request warehouse consolidation of 2+ eligible packages. */
router.post("/consolidations", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const ids = Array.isArray((req.body || {}).packageIds) ? req.body.packageIds.map(String) : [];
  if (ids.length < 2) return res.status(400).json({ message: "Consolidation needs at least two packages." });
  const pkgs = ids.map((id) => (db.data.packages || []).find((p) => p._id === id || p.packageId === id)).filter(Boolean);
  if (pkgs.length !== ids.length) return res.status(404).json({ message: "One or more packages were not found." });
  for (const p of pkgs) {
    if (p.customerEmail !== user.email) return res.status(403).json({ message: `Package ${p.packageId} is not yours.` });
    if (!["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "REPACKING"].includes(p.status)) {
      return res.status(409).json({ message: `Package ${p.packageId} is ${p.status} and cannot be consolidated now.` });
    }
  }
  const busy = (db.data.consolidations || []).some(
    (c) => c.customerEmail === user.email && ["REQUESTED", "IN_PROGRESS"].includes(c.status) && c.packageIds.some((x) => ids.includes(x)),
  );
  if (busy) return res.status(409).json({ message: "One of these packages is already in a consolidation request." });
  const row = {
    _id: crypto.randomUUID(),
    consolidationId: "SKC-" + String(Math.floor(100000 + Math.random() * 899999)),
    customerEmail: user.email,
    memberCode: memberRow(user)?.memberCode || null,
    packageIds: pkgs.map((p) => p._id),
    packageRefs: pkgs.map((p) => p.packageId),
    priorStatuses: Object.fromEntries(pkgs.map((p) => [p._id, p.status])),
    status: "REQUESTED",
    requestedAt: new Date().toISOString(),
    completedAt: null,
    note: String((req.body || {}).note || "").trim().slice(0, 1000),
    repack: (req.body || {}).repack === true,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.consolidations = db.data.consolidations || [];
  db.data.consolidations.push(row);
  for (const p of pkgs) {
    p.status = "CONSOLIDATION_PENDING";
    p.updatedAt = new Date().toISOString();
  }
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "CONSOLIDATION_REQUESTED", entity: "consolidation", entityId: row._id, changes: { consolidationId: row.consolidationId, packages: row.packageRefs, repack: row.repack } });
  return res.status(201).json({ message: "Consolidation request sent to the warehouse.", consolidation: row });
}));

/** GET /api/consolidations — my consolidation requests. */
router.get("/consolidations", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const rows = (db.data.consolidations || []).filter((c) => c.customerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ consolidations: rows });
}));

/* ------------------------------ advisory: restricted items ------------------------------ */

/** GET /api/restricted/categories — informational advisory list (rules vary by route/carrier). */
router.get("/restricted/categories", requireAuth, ah(async (req, res) => {
  return res.json({
    categories: RESTRICTED_CATEGORIES,
    note: "Advisory only — exact restrictions are confirmed per origin, destination and carrier before dispatch.",
  });
}));

/* ------------------------------ admin queues ------------------------------ */

router.get("/admin/customs", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const { status, flagged } = req.query;
  let rows = [...(db.data.declarations || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) rows = rows.filter((d) => d.status === status);
  if (flagged === "true") rows = rows.filter((d) => d.flagged === true);
  return res.json({ declarations: rows });
}));

/** POST /api/admin/customs/:id/review — approve | flag | more_info (reason recorded, audited). */
router.post("/admin/customs/:id/review", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const row = (db.data.declarations || []).find((d) => d._id === req.params.id || d.declarationId === req.params.id);
  if (!row) return res.status(404).json({ message: "Declaration not found." });
  const action = String((req.body || {}).action || "");
  if (!["approve", "flag", "more_info"].includes(action)) return res.status(400).json({ message: "Action must be approve, flag or more_info." });
  const reason = String((req.body || {}).reason || "").trim().slice(0, 500);
  row.status = action === "approve" ? "APPROVED" : action === "more_info" ? "MORE_INFO" : "FLAGGED";
  row.flagged = action === "flag";
  row.reviewNote = reason;
  row.reviewedBy = req.user.email;
  row.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: `CUSTOMS_${row.status}`, entity: "declaration", entityId: row._id, reason, changes: { declarationId: row.declarationId, flagged: row.flagged } });
  sendGenericEmail({
    to: row.customerEmail,
    subject: `Customs declaration ${row.declarationId}: ${row.status}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2><p>Your customs declaration <strong>${row.declarationId}</strong> is <strong>${row.status}</strong>.</p>${reason ? `<p style="color:#0f172a">${reason.replace(/</g, "&lt;")}</p>` : ""}</div>`,
  }).catch((e) => console.error(`[mail] customs update to ${row.customerEmail} failed:`, e?.message ?? e));
  return res.json({ message: `Declaration ${row.status}.`, declaration: row });
}));

router.get("/admin/consolidations", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const { status } = req.query;
  let rows = [...(db.data.consolidations || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) rows = rows.filter((c) => c.status === status);
  return res.json({ consolidations: rows });
}));

/**
 * POST /api/admin/consolidations/:id/status — accept | complete | cancel.
 * complete: warehouse records the combined weight/dimensions and moves the
 * packages to CONSOLIDATED. cancel: restores each package's prior status.
 */
router.post("/admin/consolidations/:id/status", requireAuth, requireRole(ADMIN_ROLES), ah(async (req, res) => {
  const row = (db.data.consolidations || []).find((c) => c._id === req.params.id || c.consolidationId === req.params.id);
  if (!row) return res.status(404).json({ message: "Consolidation not found." });
  const action = String((req.body || {}).action || "");
  const note = String((req.body || {}).note || "").trim().slice(0, 1000);
  if (!["accept", "complete", "cancel"].includes(action)) return res.status(400).json({ message: "Action must be accept, complete or cancel." });
  if (action === "accept") {
    if (row.status !== "REQUESTED") return res.status(409).json({ message: `Cannot accept a ${row.status} consolidation.` });
    row.status = "IN_PROGRESS";
  } else if (action === "cancel") {
    if (!["REQUESTED", "IN_PROGRESS"].includes(row.status)) return res.status(409).json({ message: `Cannot cancel a ${row.status} consolidation.` });
    for (const pid of row.packageIds) {
      const p = (db.data.packages || []).find((x) => x._id === pid);
      if (!p) continue;
      const prior = row.priorStatuses?.[pid] || "RECEIVED";
      p.status = prior;
      p.updatedAt = new Date().toISOString();
    }
    row.status = "CANCELLED";
    row.note = note;
  } else {
    if (row.status !== "IN_PROGRESS") return res.status(409).json({ message: `Only an in-progress consolidation can be completed (${row.status}).` });
    const b = req.body || {};
    const weight = Number(b.weight);
    const len = Number(b.length);
    const wid = Number(b.width);
    const hei = Number(b.height);
    const volumetric = len && wid && hei ? (len * wid * hei) / 5000 : 0;
    const chargeable = Math.max(weight || 0, volumetric || 0);
    row.result = {
      weight: weight || null,
      length: len || null,
      width: wid || null,
      height: hei || null,
      volumetricWeight: volumetric || null,
      chargeableWeight: chargeable || null,
      note,
    };
    for (const pid of row.packageIds) {
      const p = (db.data.packages || []).find((x) => x._id === pid);
      if (!p) continue;
      p.status = "CONSOLIDATED";
      p.weight = weight || p.weight;
      p.length = len || p.length;
      p.width = wid || p.width;
      p.height = hei || p.height;
      p.volumetricWeight = volumetric || p.volumetricWeight;
      p.chargeableWeight = chargeable || p.chargeableWeight;
      p.consolidationId = row._id;
      p.updatedAt = new Date().toISOString();
      addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "PACKAGE_CONSOLIDATED", entity: "package", entityId: p._id, changes: { consolidationId: row.consolidationId, packageId: p.packageId, chargeableWeight: chargeable } });
    }
    row.status = "COMPLETED";
    row.completedAt = new Date().toISOString();
    row.note = note;
    sendGenericEmail({
      to: row.customerEmail,
      subject: `Consolidation ${row.consolidationId} completed`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2><p>Your consolidation <strong>${row.consolidationId}</strong> is complete — packages are ready for the next step.</p><p><a href="${WEB_URL}/account/billing">Review in your dashboard</a></p></div>`,
    }).catch((e) => console.error(`[mail] consolidation complete to ${row.customerEmail} failed:`, e?.message ?? e));
  }
  row.updatedAt = new Date().toISOString();
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: `CONSOLIDATION_${action.toUpperCase()}`, entity: "consolidation", entityId: row._id, reason: note, changes: { consolidationId: row.consolidationId, status: row.status } });
  return res.json({ message: `Consolidation ${row.status}.`, consolidation: row });
}));

export default router;
