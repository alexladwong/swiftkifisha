/**
 * Commercial parcel-forwarding helpers: shared state machines, audit logging,
 * idempotency keys and seeds. Backend is the source of truth for every status
 * transition — the frontend never sets raw statuses.
 */
import crypto from "node:crypto";
import { db } from "./db.js";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES } from "./intl.js";

/* ------------------------------ status machines ------------------------------ */

export const PACKAGE_STATUS = {
  PRE_ALERTED: "PRE_ALERTED",
  EXPECTED: "EXPECTED",
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  READY_TO_SHIP: "READY_TO_SHIP",
  CONSOLIDATION_PENDING: "CONSOLIDATION_PENDING",
  CONSOLIDATED: "CONSOLIDATED",
  REPACKING: "REPACKING",
  READY_FOR_PAYMENT: "READY_FOR_PAYMENT",
  SHIPMENT_CREATED: "SHIPMENT_CREATED",
  DISPATCHED: "DISPATCHED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURNED: "RETURNED",
  DISPOSED: "DISPOSED",
  HOLD: "HOLD",
  EXCEPTION: "EXCEPTION",
};

// Authorized transitions. A transition can carry one or more next states;
// the caller (warehouse/staff rule) picks among them.
export const PACKAGE_TRANSITIONS = {
  PRE_ALERTED: ["EXPECTED", "RECEIVED", "HOLD", "EXCEPTION"],
  EXPECTED: ["RECEIVED", "ACTION_REQUIRED", "EXCEPTION"],
  RECEIVED: ["PROCESSING", "ACTION_REQUIRED", "HOLD", "EXCEPTION"],
  PROCESSING: ["ACTION_REQUIRED", "READY_TO_SHIP", "HOLD", "EXCEPTION"],
  ACTION_REQUIRED: ["READY_TO_SHIP", "REPACKING", "CONSOLIDATION_PENDING", "RETURN_REQUESTED", "DISPOSED", "HOLD", "EXCEPTION"],
  READY_TO_SHIP: ["SHIPMENT_CREATED", "REPACKING", "CONSOLIDATION_PENDING", "HOLD", "RETURN_REQUESTED"],
  CONSOLIDATION_PENDING: ["CONSOLIDATED", "PROCESSING", "EXCEPTION"],
  CONSOLIDATED: ["REPACKING", "READY_TO_SHIP", "EXCEPTION"],
  REPACKING: ["READY_TO_SHIP", "CONSOLIDATED", "ACTION_REQUIRED", "EXCEPTION"],
  READY_FOR_PAYMENT: ["SHIPMENT_CREATED", "ACTION_REQUIRED", "EXCEPTION"],
  SHIPMENT_CREATED: ["DISPATCHED", "EXCEPTION", "ACTION_REQUIRED"],
  DISPATCHED: ["DISPATCHED"],
  RETURN_REQUESTED: ["RETURNED", "PROCESSING", "EXCEPTION"],
  RETURNED: [],
  DISPOSED: [],
  HOLD: ["PROCESSING", "ACTION_REQUIRED", "RETURN_REQUESTED", "DISPOSED", "EXCEPTION"],
  EXCEPTION: ["PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "HOLD", "RETURN_REQUESTED", "DISPOSED"],
};

export function canTransition(from, to) {
  return Boolean(PACKAGE_TRANSITIONS[from] && PACKAGE_TRANSITIONS[from].includes(to));
}

// Customer-requestable actions and the status they move the package into.
// Actions with `to: null` are advisory (no status transition).
export const PACKAGE_ACTIONS = {
  ship: { to: "READY_FOR_PAYMENT", allowedFrom: ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "CONSOLIDATED", "REPACKING"] },
  consolidate: { to: "CONSOLIDATION_PENDING", allowedFrom: ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "REPACKING"] },
  repack: { to: "REPACKING", allowedFrom: ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "CONSOLIDATION_PENDING"] },
  hold: { to: "HOLD", allowedFrom: ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP"] },
  returnToSender: { to: "RETURN_REQUESTED", allowedFrom: ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "HOLD"] },
  dispose: { to: "DISPOSED", allowedFrom: ["ACTION_REQUIRED", "HOLD", "EXCEPTION"] },
};

/** Actions a package may currently offer (used by the member detail page). */
export function allowedActionsFor(pkg) {
  const out = [];
  for (const [name, rule] of Object.entries(PACKAGE_ACTIONS)) {
    if (rule.allowedFrom.includes(pkg.status)) out.push(name);
  }
  if (pkg.status === "RECEIVED" || pkg.status === "PROCESSING" || pkg.status === "ACTION_REQUIRED") {
    out.push("requestPhotos", "reportProblem");
  }
  return out;
}

export function actionTarget(name) {
  const rule = PACKAGE_ACTIONS[name];
  return rule ? rule.to : null;
}

/* --------------------------------- audit log --------------------------------- */

export function addAudit({ actorId, actorEmail, actorRole, action, entity, entityId, reason, changes }) {
  const row = {
    _id: crypto.randomUUID(),
    actorId, actorEmail, actorRole,
    action, entity, entityId,
    reason: reason || "",
    changes: changes || null,
    createdAt: new Date().toISOString(),
  };
  db.data.auditLogs = db.data.auditLogs || [];
  db.data.auditLogs.push(row);
  db.persist();
  return row;
}

/* ------------------------------ idempotency keys ------------------------------ */

const seen = new Map();
export function withIdempotency(key, windowMs, fn) {
  const now = Date.now();
  const existing = seen.get(key);
  if (existing && now - existing.at < windowMs) {
    return existing.result;
  }
  const result = fn();
  seen.set(key, { at: now, result });
  if (seen.size > 5000) {
    for (const [k, v] of seen) if (now - v.at > 60 * 60 * 1000) seen.delete(k);
  }
  return result;
}

/* ---------------------------------- seeds ---------------------------------- */

export function seedCommerceDefaults() {
  let changed = false;
  if (!db.data.warehouses || db.data.warehouses.length === 0) {
    db.data.warehouses = HUB_COUNTRIES.map((hub) => {
      const sample = HUB_MAILBOX_EXAMPLES[hub.country] || [];
      return {
        _id: crypto.randomUUID(),
        code: hub.code,
        name: `${hub.city} Fulfilment Hub`,
        country: hub.country,
        city: hub.city,
        addressLines: sample,
        phone: "",
        timezone: "UTC",
        currency: hub.currency,
        status: "ACTIVE",
        capabilities: ["receiving", "storage", "consolidation"],
        supportedCarriers: [],
        operatingHours: "Mon-Sat 08:00-18:00",
        createdAt: new Date().toISOString(),
      };
    });
    changed = true;
  }
  if (!db.data.pricingRules || db.data.pricingRules.length === 0) {
    db.data.pricingRules = [
      { _id: crypto.randomUUID(), code: "storage.freeDays", value: 7, unit: "days", note: "Free storage after receipt" },
      { _id: crypto.randomUUID(), code: "storage.dailyRateUSD", value: 0.5, unit: "USD/day", note: "Per package after free days" },
      { _id: crypto.randomUUID(), code: "service.repackBasic", value: 3, unit: "USD", note: "Standard repack" },
      { _id: crypto.randomUUID(), code: "service.consolidation", value: 0, unit: "USD", note: "Consolidation fee" },
      { _id: crypto.randomUUID(), code: "insurance.ratePct", value: 2.5, unit: "%", note: "of declared value per shipment" },
      { _id: crypto.randomUUID(), code: "fees.originsHandling", value: 5, unit: "USD", note: "Warehouse handling fee per shipment" },
      { _id: crypto.randomUUID(), code: "rate.basePerKgUSD", value: 8, unit: "USD/kg", note: "Phase-1 base rate per kg (carrier tariffs replace this)" },
    ];
    changed = true;
  }
  if (!db.data.carriers || db.data.carriers.length === 0) {
    db.data.carriers = [
      { _id: crypto.randomUUID(), code: "SWIFT_INTERNAL", name: "SwiftKifisha Ops (internal handover)", integration: "internal", status: "CONFIGURED", note: "Used for warehouse-to-carrier handoff labels before real carrier credentials exist" },
      { _id: crypto.randomUUID(), code: "DHL", name: "DHL Express", integration: "api", status: "NOT_CONFIGURED" },
      { _id: crypto.randomUUID(), code: "FEDEX", name: "FedEx", integration: "api", status: "NOT_CONFIGURED" },
      { _id: crypto.randomUUID(), code: "ARAMEX", name: "Aramex", integration: "api", status: "NOT_CONFIGURED" },
      { _id: crypto.randomUUID(), code: "UG_MTN", name: "MTN Mobile Money Uganda", integration: "payment", status: "NOT_CONFIGURED" },
      { _id: crypto.randomUUID(), code: "UG_AIRTEL", name: "Airtel Money Uganda", integration: "payment", status: "NOT_CONFIGURED" },
    ];
    changed = true;
  }
  // Referral/points program rules (append when missing).
  const referralRules = [
    { code: "referral.pointsPerReferral", value: 1000, unit: "points", note: "Points awarded per accepted referral" },
    { code: "referral.minRedeem", value: 1000, unit: "points", note: "Minimum points for one redemption" },
    { code: "referral.pointsValueUsd", value: 0.001, unit: "USD/pt", note: "Wallet credit value per redeemed point" },
  ];
  for (const rule of referralRules) {
    if (!db.data.pricingRules.some((r) => r.code === rule.code)) {
      db.data.pricingRules.push({ _id: crypto.randomUUID(), ...rule });
      changed = true;
    }
  }
  if (changed) db.persist();
}

export function ruleValue(code, fallback = null) {
  const row = (db.data.pricingRules || []).find((r) => r.code === code);
  return row ? row.value : fallback;
}
