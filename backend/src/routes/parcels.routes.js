import { Router } from "express";
import { db, objectId, generateTrackingId } from "../lib/db.js";
import { calculatePrice } from "../lib/pricing.js";
import {
  PARCEL_CATEGORIES, DELIVERY_TYPES, SHIPMENT_TYPES, PARCEL_STATUSES,
  PAKISTANI_CITIES, INTERNATIONAL_DESTINATION_OPTIONS,
} from "../lib/referenceData.js";
import { formatDateTime, clamp, escapeRegExp } from "../lib/util.js";
import { ah, requireAuth } from "../middleware/auth.js";

const router = Router();

/* ------------------------------- helpers ------------------------------- */

const isObjectId = (id) => /^[0-9a-f]{24}$/i.test(id || "");

function validateParcelInput(body, { full = false } = {}) {
  const errors = [];
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const need = (field, label) => {
    if (!s(body[field])) errors.push(`${label} is required.`);
  };
  if (full) {
    need("senderName", "Sender name");
    need("senderPhone", "Sender phone");
    need("senderAddress", "Sender address");
    need("receiverName", "Receiver name");
    need("receiverPhone", "Receiver phone");
    need("receiverAddress", "Receiver address");
  }
  need("originCity", "Origin city");
  need("destinationCity", "Destination city");

  const shipmentType = s(body.shipmentType);
  if (!SHIPMENT_TYPES.includes(shipmentType)) errors.push("Shipment type must be national or international.");
  const deliveryType = s(body.deliveryType);
  if (!DELIVERY_TYPES.includes(deliveryType)) errors.push("Delivery type must be sameDay, overnight or standard.");
  const parcelCategory = s(body.parcelCategory);
  if (!PARCEL_CATEGORIES.includes(parcelCategory)) errors.push("Invalid parcel category.");

  const weight = Number(body.weight);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
    errors.push("Weight must be a positive number (kg).");
  }

  if (shipmentType === "national" && !PAKISTANI_CITIES.includes(s(body.originCity))) {
    errors.push(`${body.originCity} is not a valid Pakistani origin city.`);
  }
  if (shipmentType === "national" && s(body.originCity) === s(body.destinationCity)) {
    errors.push("Origin and destination cities cannot be the same.");
  }
  const destOk =
    shipmentType === "international"
      ? INTERNATIONAL_DESTINATION_OPTIONS.some((o) => o.value === s(body.destinationCity))
      : PAKISTANI_CITIES.includes(s(body.destinationCity));
  if (shipmentType && !destOk) {
    errors.push("Destination city is not valid for the selected shipment type.");
  }

  return { errors, values: {
    senderName: full ? s(body.senderName) : s(body.senderName),
    senderPhone: full ? s(body.senderPhone) : s(body.senderPhone),
    senderAddress: full ? s(body.senderAddress) : s(body.senderAddress),
    receiverName: full ? s(body.receiverName) : s(body.receiverName),
    receiverPhone: full ? s(body.receiverPhone) : s(body.receiverPhone),
    receiverAddress: full ? s(body.receiverAddress) : s(body.receiverAddress),
    originCity: s(body.originCity), destinationCity: s(body.destinationCity),
    shipmentType, deliveryType, parcelCategory, weight: Number(weight),
  } };
}

/** One tracking event; fields cover both the dashboard and customer timelines. */
function checkpointRecord({ status, location, message, at = new Date() }) {
  const iso = at.toISOString();
  return { status, location, message, timestamp: iso, timestamps: iso, dateTime: formatDateTime(at) };
}

/* ------------------------------- routes -------------------------------- */

/**
 * POST /api/parcels/calculate-cost  (public)
 * Quote: { originCity, destinationCity, shipmentType, parcelCategory, weight, deliveryType }
 */
router.post("/calculate-cost", ah(async (req, res) => {
  const { errors, values } = validateParcelInput(req.body || {}, { full: false });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });
  const { price, currency } = calculatePrice(values);
  return res.json({
    type: values.deliveryType,          // key used by the customer cost page
    deliveryType: values.deliveryType,
    parcelCategory: values.parcelCategory,
    shipmentType: values.shipmentType,
    originCity: values.originCity,
    destinationCity: values.destinationCity,
    weight: values.weight,
    price,
    currency,
  });
}));

/** GET /api/parcels/track/:trackingId  (public) */
router.get("/track/:trackingId", ah(async (req, res) => {
  const q = String(req.params.trackingId || "").trim().toUpperCase();
  const parcel = db.data.parcels.find((p) => String(p.trackingId).toUpperCase() === q);
  if (!parcel) {
    return res.status(404).json({ message: `No parcel found with tracking ID ${req.params.trackingId}.` });
  }
  // The customer site reads a few oddly-cased keys — provide them alongside
  // the canonical fields so both frontends display the same parcel correctly.
  return res.json({ ...parcel, trackingID: parcel.trackingId, shimpentType: parcel.shipmentType, Weight: parcel.weight });
}));

/** GET /api/parcels?page=&limit=&search=  (admin) */
router.get("/", requireAuth, ah(async (req, res) => {
  const page = clamp(parseInt(req.query.page, 10) || 1, 1, 100000);
  const limit = clamp(parseInt(req.query.limit, 10) || 10, 1, 100);
  const search = String(req.query.search || "").trim();

  let rows = db.data.parcels;
  if (search) {
    const re = new RegExp(escapeRegExp(search), "i");
    rows = rows.filter(
      (p) => re.test(p.trackingId) || re.test(p.senderName) || re.test(p.receiverName)
        || re.test(p.originCity) || re.test(p.destinationCity),
    );
  }
  rows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const data = rows.slice((safePage - 1) * limit, safePage * limit);
  return res.json({ data, page: safePage, limit, total, totalPages });
}));

/** POST /api/parcels  (admin) — create a shipment, price computed server side. */
router.post("/", requireAuth, ah(async (req, res) => {
  const { errors, values } = validateParcelInput(req.body || {}, { full: true });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const now = new Date();
  const { price, currency } = calculatePrice(values);
  const parcel = {
    _id: objectId(),
    trackingId: generateTrackingId(db.data.parcels),
    ...values,
    price,
    currency,
    status: "arrived",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    checkpoints: [
      checkpointRecord({
        status: "arrived",
        location: values.originCity,
        message: "Shipment booked. Parcel received at origin facility.",
        at: now,
      }),
    ],
  };
  db.data.parcels.push(parcel);
  db.persist();
  return res.status(201).json(parcel);
}));

/** POST /api/parcels/:id/checkpoint  (admin) — append a tracking event. */
router.post("/:id/checkpoint", requireAuth, ah(async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ message: "Invalid parcel id." });
  const parcel = db.data.parcels.find((p) => p._id === id);
  if (!parcel) return res.status(404).json({ message: "Parcel not found." });

  const { location, title, status, description } = req.body || {};
  const cleanStatus = String(status || "").trim();
  if (!PARCEL_STATUSES.includes(cleanStatus)) {
    return res.status(400).json({ message: "Status must be one of: " + PARCEL_STATUSES.join(", ") + "." });
  }
  if (!location || !String(location).trim()) return res.status(400).json({ message: "Checkpoint location is required." });
  if (!title || !String(title).trim()) return res.status(400).json({ message: "Checkpoint title is required." });

  const message = String(description || "").trim() || String(title).trim();
  parcel.checkpoints.push(
    checkpointRecord({
      status: cleanStatus,
      location: String(location).trim(),
      message,
      at: new Date(),
    }),
  );
  parcel.status = cleanStatus;
  parcel.updatedAt = parcel.checkpoints[parcel.checkpoints.length - 1].timestamp;
  db.persist();
  return res.json(parcel);
}));

export default router;
