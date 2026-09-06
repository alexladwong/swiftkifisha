/**
 * Shared vocabulary for the Phase-1 warehouse package operations admin UI.
 * Package statuses/labels/colors (and the condition / photo-view options used
 * by the receiving + packages pages) live here in one place so the pages and
 * <PackageStatusBadge /> never drift apart. Values mirror the backend state
 * machine (backend/src/lib/commerce.js) — transitions themselves always come
 * from the server (pkg.allowedTransitions).
 */

/** Full lifecycle set the backend state machine knows about. */
export const PACKAGE_STATUSES = [
  "PRE_ALERTED",
  "EXPECTED",
  "RECEIVED",
  "PROCESSING",
  "ACTION_REQUIRED",
  "READY_TO_SHIP",
  "CONSOLIDATION_PENDING",
  "CONSOLIDATED",
  "REPACKING",
  "READY_FOR_PAYMENT",
  "SHIPMENT_CREATED",
  "DISPATCHED",
  "RETURN_REQUESTED",
  "RETURNED",
  "DISPOSED",
  "HOLD",
  "EXCEPTION",
];

export const STATUS_LABEL = {
  PRE_ALERTED: "Pre-alerted",
  EXPECTED: "Expected",
  RECEIVED: "Received",
  PROCESSING: "Processing",
  ACTION_REQUIRED: "Action required",
  READY_TO_SHIP: "Ready to ship",
  CONSOLIDATION_PENDING: "Consolidation pending",
  CONSOLIDATED: "Consolidated",
  REPACKING: "Repacking",
  READY_FOR_PAYMENT: "Ready for payment",
  SHIPMENT_CREATED: "Shipment created",
  DISPATCHED: "Dispatched",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  DISPOSED: "Disposed",
  HOLD: "On hold",
  EXCEPTION: "Exception",
};

/** Tailwind chip colors, in the same soft palette the dashboard uses. */
export const STATUS_STYLE = {
  PRE_ALERTED: "bg-violet-100 text-violet-800",
  EXPECTED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  PROCESSING: "bg-cyan-100 text-cyan-800",
  ACTION_REQUIRED: "bg-amber-100 text-amber-800",
  READY_TO_SHIP: "bg-teal-100 text-teal-800",
  CONSOLIDATION_PENDING: "bg-sky-100 text-sky-800",
  CONSOLIDATED: "bg-indigo-100 text-indigo-800",
  REPACKING: "bg-purple-100 text-purple-800",
  READY_FOR_PAYMENT: "bg-orange-100 text-orange-800",
  SHIPMENT_CREATED: "bg-lime-100 text-lime-800",
  DISPATCHED: "bg-green-100 text-green-800",
  RETURN_REQUESTED: "bg-rose-100 text-rose-800",
  RETURNED: "bg-slate-200 text-slate-700",
  DISPOSED: "bg-zinc-200 text-zinc-700",
  HOLD: "bg-yellow-100 text-yellow-800",
  EXCEPTION: "bg-red-100 text-red-700",
};

/** Incoming-condition options used by the receiving form and corrections. */
export const CONDITIONS = ["undamaged", "damaged", "open box", "sealed", "other"];
export const CONDITION_LABEL = {
  undamaged: "Undamaged",
  damaged: "Damaged",
  "open box": "Open box",
  sealed: "Sealed",
  other: "Other",
};

/** Photo "view" tags accepted by the photo upload endpoint. */
export const PHOTO_VIEWS = ["front", "back", "label", "damage", "contents"];
export const PHOTO_VIEW_LABEL = {
  front: "Front",
  back: "Back",
  label: "Label",
  damage: "Damage",
  contents: "Contents",
};

/** Currencies used by the commercial forwarding accounts. */
export const CURRENCIES = ["USD", "EUR", "GBP", "UGX"];

/* ------------------------------- formatters ------------------------------- */

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

export const fmtBytes = (n) => {
  const size = Number(n) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const fmtKg = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v)} kg`);
