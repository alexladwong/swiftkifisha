import { Router } from "express";
import { db, objectId, generateTrackingId } from "../lib/db.js";
import { calculatePrice, calculateQuote } from "../lib/pricing.js";
import {
  PARCEL_CATEGORIES, DELIVERY_TYPES, SHIPMENT_TYPES, PARCEL_STATUSES,
  UGANDA_CITIES, UGANDA_REGION_NAMES,
} from "../lib/referenceData.js";
import { HUB_COUNTRIES, WORLD_COUNTRIES_WITH_CAPITALS } from "../lib/intl.js";
import { formatDateTime, clamp, escapeRegExp } from "../lib/util.js";
import { ah, requireAuth } from "../middleware/auth.js";

const router = Router();

/* ------------------------------- helpers ------------------------------- */

const isObjectId = (id) => /^[0-9a-f]{24}$/i.test(id || "");
const s = (v) => (typeof v === "string" ? v.trim() : "");

const WORLD_OPTIONS = WORLD_COUNTRIES_WITH_CAPITALS.map((o) => o.value);
const HUB_COUNTRY_NAMES = HUB_COUNTRIES.map((h) => h.country);
const UG = "Uganda";

function parseCountryCity(destinationCity) {
  // Accept "Country, Capital" options or a bare country name.
  const direct = WORLD_COUNTRIES_WITH_CAPITALS.find((o) => o.country === destinationCity || o.value === destinationCity);
  if (direct) return { country: direct.country, city: direct.value };
  return null;
}

/**
 * Validates a parcel or a quote.
 *  - national: both cities must be Ugandan cities (domestic service)
 *  - international: origin is a SwiftUg hub country or Uganda; destination is
 *    any worldwide country (given via destinationCountry and/or
 *    "Country, Capital" destinationCity).
 */
function validateParcelInput(body, { full = false } = {}) {
  const errors = [];
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

  let originCountry = s(body.originCountry) || UG;
  let destinationCountry = s(body.destinationCountry) || "";
  const originCity = s(body.originCity);
  const destinationCity = s(body.destinationCity);

  if (shipmentType === "national") {
    if (!UGANDA_CITIES.includes(originCity) && !UGANDA_REGION_NAMES.includes(originCity)) errors.push("Origin must be a valid Ugandan city or region.");
    if (!UGANDA_CITIES.includes(destinationCity) && !UGANDA_REGION_NAMES.includes(destinationCity)) errors.push("Destination must be a valid Ugandan city or region.");
    if (originCity && originCity === destinationCity) errors.push("Origin and destination cities cannot be the same.");
    originCountry = UG;
    destinationCountry = UG;
  } else {
    if (originCountry !== UG && !HUB_COUNTRY_NAMES.includes(originCountry)) {
      errors.push(`Origin country must be Uganda or one of our Fikisha hubs (${HUB_COUNTRY_NAMES.join(", ")}).`);
    }
    if (destinationCountry) {
      const known = WORLD_COUNTRIES_WITH_CAPITALS.find((o) => o.country === destinationCountry);
      if (!known) errors.push("Destination country is not served.");
    } else {
      const parsed = parseCountryCity(destinationCity);
      if (parsed) {
        destinationCountry = parsed.country;
      } else {
        errors.push("Destination city must include a served country (e.g. \"United Kingdom, London\").");
      }
    }
  }

  return { errors, values: {
    senderName: full ? s(body.senderName) : s(body.senderName),
    senderPhone: full ? s(body.senderPhone) : s(body.senderPhone),
    senderAddress: full ? s(body.senderAddress) : s(body.senderAddress),
    receiverName: full ? s(body.receiverName) : s(body.receiverName),
    receiverPhone: full ? s(body.receiverPhone) : s(body.receiverPhone),
    receiverAddress: full ? s(body.receiverAddress) : s(body.receiverAddress),
    originCity: originCity || (shipmentType === "international" && HUB_COUNTRY_NAMES.includes(originCountry)
      ? `${HUB_COUNTRIES.find((h) => h.country === originCountry)?.city}, ${originCountry}` : ""),
    destinationCity: destinationCity || destinationCountry,
    shipmentType, deliveryType, parcelCategory, weight: Number(weight),
    originCountry,
    destinationCountry,
    storeName: s(body.storeName),
    memberEmail: s(body.memberEmail),
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
 * Domestic:   { shipmentType:"national", originCity, destinationCity, parcelCategory, weight, deliveryType }
 * Fikisha:  { shipmentType:"international", originCountry:"United States", destinationCountry:"Uganda",
 *               destinationCity?:"Kampala", parcelCategory, weight, deliveryType }
 */
router.post("/calculate-cost", ah(async (req, res) => {
  const { errors, values } = validateParcelInput(req.body || {}, { full: false });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });
  const quote = calculateQuote(values);
  const extras =
    quote.currency === "UGX"
      ? { distanceKm: quote.distanceKm ?? null, billableWeight: quote.billableWeight, breakdown: quote.breakdown ?? null }
      : { billableWeight: quote.billableWeight };
  return res.json({
    type: values.deliveryType,          // key used by the customer cost page
    deliveryType: values.deliveryType,
    parcelCategory: values.parcelCategory,
    shipmentType: values.shipmentType,
    originCity: values.originCity,
    destinationCity: values.destinationCity,
    originCountry: values.originCountry,
    destinationCountry: values.destinationCountry,
    weight: values.weight,
    price: quote.price,
    currency: quote.currency,
    ...extras,
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

/**
 * GET /api/parcels?page=&limit=&search=&member=&originCountry=&destinationCountry=  (admin)
 */
router.get("/", requireAuth, ah(async (req, res) => {
  const page = clamp(parseInt(req.query.page, 10) || 1, 1, 100000);
  const limit = clamp(parseInt(req.query.limit, 10) || 10, 1, 100);
  const search = String(req.query.search || "").trim();
  const member = String(req.query.member || "").trim();
  const originCountry = String(req.query.originCountry || "").trim();
  const destinationCountry = String(req.query.destinationCountry || "").trim();

  let rows = db.data.parcels;
  if (member) {
    const re = new RegExp(escapeRegExp(member), "i");
    rows = rows.filter((p) => (p.memberId && p.memberId === member) || re.test(p.memberEmail || ""));
  }
  if (search) {
    const re = new RegExp(escapeRegExp(search), "i");
    rows = rows.filter(
      (p) => re.test(p.trackingId) || re.test(p.senderName) || re.test(p.receiverName)
        || re.test(p.originCity) || re.test(p.destinationCity)
        || re.test(p.memberEmail || "") || re.test(p.storeName || ""),
    );
  }
  if (originCountry) rows = rows.filter((p) => p.originCountry === originCountry);
  if (destinationCountry) rows = rows.filter((p) => p.destinationCountry === destinationCountry);

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
        location: values.originCity || values.originCountry,
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