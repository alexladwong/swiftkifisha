/**
 * Shared vocabulary for the Phase-2 finance admin UI (Payments, Invoices,
 * Shipments, Pricing). Payment/invoice/shipment statuses, labels, chip colors
 * and payment-channel labels live here in one place so the pages never drift
 * apart. Values mirror the backend finance domain; machine transitions
 * themselves always come from the server (shipment.allowedTransitions).
 */

/** Payment lifecycle statuses shown in the finance queue. */
export const PAYMENT_STATUSES = ["PENDING", "PROCESSING", "PAYMENT_SUBMITTED", "PAID", "FAILED", "REJECTED", "CANCELLED", "EXPIRED"];

export const PAYMENT_STATUS_LABEL = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAYMENT_SUBMITTED: "Submitted",
  PAID: "Paid",
  FAILED: "Failed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

/** Soft chip colors, in the same palette the dashboard uses. */
export const PAYMENT_STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  PAYMENT_SUBMITTED: "bg-violet-100 text-violet-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-orange-100 text-orange-800",
};

/** Invoice lifecycle statuses. */
export const INVOICE_STATUSES = ["ISSUED", "PARTIAL", "PAID", "VOID"];

export const INVOICE_STATUS_LABEL = {
  ISSUED: "Issued",
  PARTIAL: "Partially paid",
  PAID: "Paid",
  VOID: "Void",
};

export const INVOICE_STATUS_STYLE = {
  ISSUED: "bg-blue-100 text-blue-800",
  PARTIAL: "bg-orange-100 text-orange-800",
  PAID: "bg-green-100 text-green-800",
  VOID: "bg-slate-200 text-slate-700",
};

/** Shipment lifecycle statuses (the state machine decides transitions). */
export const SHIPMENT_STATUSES = [
  "CREATED",
  "READY_FOR_CARRIER",
  "PICKED_UP",
  "IN_TRANSIT",
  "CUSTOMS_CLEARANCE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
];

export const SHIPMENT_STATUS_LABEL = {
  CREATED: "Created",
  READY_FOR_CARRIER: "Ready for carrier",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  CUSTOMS_CLEARANCE: "Customs clearance",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
};

export const SHIPMENT_STATUS_STYLE = {
  CREATED: "bg-slate-100 text-slate-700",
  READY_FOR_CARRIER: "bg-violet-100 text-violet-800",
  PICKED_UP: "bg-sky-100 text-sky-800",
  IN_TRANSIT: "bg-blue-100 text-blue-800",
  CUSTOMS_CLEARANCE: "bg-amber-100 text-amber-800",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-green-100 text-green-800",
  EXCEPTION: "bg-red-100 text-red-700",
};

/**
 * Payment-channel display names. The map matches the labels the backend
 * uses; provider channels carry a "(not configured)" hint until credentials
 * exist — nothing here means a channel is live.
 */
export const CHANNEL_LABEL = {
  OFFLINE: "Bank transfer / offline",
  WALLET: "Account credit (wallet)",
  MTN_MOMO: "MTN Mobile Money (not configured)",
  AIRTEL_MONEY: "Airtel Money (not configured)",
  CARD: "Card (not configured)",
  MPESA: "M-Pesa (Daraja)",
  FLUTTERWAVE: "Flutterwave (Card / Mobile Money)",
};

/** Channel codes whose rows show a configure/unconfigured state in the UI. */
export const PROVIDER_CHANNEL_CODES = ["MTN_MOMO", "AIRTEL_MONEY", "CARD"];

/* ------------------------------- formatters ------------------------------- */

/** Money, USD by default, always two decimals (UGX keeps no decimals). */
export const fmtMoney = (amount, currency = "USD") => {
  const n = Number(amount || 0);
  if (currency === "UGX") return `UGX ${n.toLocaleString()}`;
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency || "USD"} `;
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
