import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { calculatePrice } from "./lib/pricing";
import { requireAdmin, HttpError } from "./lib/authz";
import { UGANDA_CITIES, UGANDA_REGION_NAMES, CATEGORIES, DELIVERY_TYPES, SHIPMENT_TYPES, STATUSES, HUB_COUNTRIES } from "./lib/intl";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");

export function checkpointRecord(input: { status: string; location: string; message: string; at?: Date }) {
  const iso = (input.at ?? new Date()).toISOString();
  const dateTime = new Date(iso).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return { status: input.status, location: input.location, message: input.message, timestamp: iso, timestamps: iso, dateTime };
}

function newTrackingId(): string {
  const letters = ["CRR","SWP","PAK","SPD","XPR","FLT","PKG","AZM","NAV","QKS"];
  const l = letters[Math.floor(Math.random() * letters.length)];
  const d = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return "UG-" + l + "-" + d;
}

// Public: tracking lookup by human id.
export const track = query({
  args: { trackingId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.query("parcels").withIndex("by_trackingId", (q: any) => q.eq("trackingId", args.trackingId)).first();
    if (!doc) return null;
    return { ...doc, trackingID: doc.trackingId, shimpentType: doc.shipmentType, Weight: doc.weight };
  },
});

// Pure quote mapping shared by the query handler and the parity harness.
// Mirrors POST /api/parcels/calculate-cost on the Express backend.
export function quotePayload(args: Record<string, any>) {
  const shipmentType = SHIPMENT_TYPES.includes(str(args.shipmentType)) ? str(args.shipmentType) : "";
  if (!shipmentType) throw new HttpError(400, "Shipment type must be national or international.");
  const parcelCategory = str(args.parcelCategory);
  if (!CATEGORIES.includes(parcelCategory)) throw new HttpError(400, "Invalid parcel category.");
  const deliveryType = str(args.deliveryType);
  if (!DELIVERY_TYPES.includes(deliveryType)) throw new HttpError(400, "Invalid delivery type.");
  const weight = Number(args.weight);
  if (!Number.isFinite(weight) || weight <= 0) throw new HttpError(400, "Weight must be a positive number.");
  let originCountry = str(args.originCountry) || "Uganda";
  let destinationCountry = str(args.destinationCountry) || "Uganda";
  if (shipmentType === "international") {
    if (originCountry !== "Uganda" && !HUB_COUNTRIES.some((h) => h.country === originCountry)) {
      throw new HttpError(400, "Origin country must be Uganda or one of our shop-and-ship hubs.");
    }
  } else {
    const o = str(args.originCity); const d = str(args.destinationCity);
    if (!UGANDA_CITIES.includes(o) && !UGANDA_REGION_NAMES.includes(o)) throw new HttpError(400, "Origin must be a valid Ugandan city or region.");
    if (!UGANDA_CITIES.includes(d) && !UGANDA_REGION_NAMES.includes(d)) throw new HttpError(400, "Destination must be a valid Ugandan city or region.");
    if (o === d) throw new HttpError(400, "Origin and destination cities cannot be the same.");
    originCountry = "Uganda"; destinationCountry = "Uganda";
  }
  const { price, currency } = calculatePrice({ shipmentType, parcelCategory, weight, deliveryType, originCountry, destinationCountry });
  const hub = HUB_COUNTRIES.find((h) => h.country === originCountry);
  const defaultOriginCity = hub ? hub.city + ", " + hub.country : originCountry;
  return {
    type: deliveryType,
    deliveryType,
    parcelCategory,
    shipmentType,
    originCity: str(args.originCity) || defaultOriginCity,
    destinationCity: str(args.destinationCity) || destinationCountry,
    originCountry,
    destinationCountry,
    weight,
    price,
    currency,
  };
}

// Public: fee estimator (mirrors POST /api/parcels/calculate-cost).
export const quote = query({
  args: {
    shipmentType: v.optional(v.string()),
    originCity: v.optional(v.string()),
    destinationCity: v.optional(v.string()),
    originCountry: v.optional(v.string()),
    destinationCountry: v.optional(v.string()),
    parcelCategory: v.optional(v.string()),
    weight: v.optional(v.number()),
    deliveryType: v.optional(v.string()),
  },
  handler: async (_ctx, args) => quotePayload(args as Record<string, any>),
});

// Admin: paged + filtered list (mirrors GET /api/parcels).
// NOTE: implemented as a mutation so the Better Auth component adapter can
// read the session/user tables (queries cannot reach component tables).
export const list = mutation({
  args: {
    token: v.union(v.null(), v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    member: v.optional(v.string()),
    originCountry: v.optional(v.string()),
    destinationCountry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const page = clamp(Number(args.page) || 1, 1, 100000);
    const limit = clamp(Number(args.limit) || 10, 1, 100);
    const search = str(args.search);
    const member = str(args.member);
    const originCountry = str(args.originCountry);
    const destinationCountry = str(args.destinationCountry);
    let rows = await ctx.db.query("parcels").collect();
    if (member) {
      const lower = member.toLowerCase();
      rows = rows.filter((p) => p.memberId === member || (p.memberEmail ?? "").toLowerCase().includes(lower));
    }
    if (search) {
      const lower = search.toLowerCase();
      rows = rows.filter((p) =>
        p.trackingId.toLowerCase().includes(lower) || p.senderName.toLowerCase().includes(lower)
        || p.receiverName.toLowerCase().includes(lower) || p.originCity.toLowerCase().includes(lower)
        || p.destinationCity.toLowerCase().includes(lower) || (p.memberEmail ?? "").toLowerCase().includes(lower)
        || (p.storeName ?? "").toLowerCase().includes(lower),
      );
    }
    if (originCountry) rows = rows.filter((p) => p.originCountry === originCountry);
    if (destinationCountry) rows = rows.filter((p) => p.destinationCountry === destinationCountry);
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    return { data: rows.slice((safePage - 1) * limit, safePage * limit), page: safePage, limit, total, totalPages };
  },
});

// Admin: create a shipment (mirrors POST /api/parcels).
export const create = mutation({
  args: { token: v.union(v.null(), v.string()), parcel: v.any() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const b = args.parcel ?? {};
    const errors: string[] = [];
    const need = (field: string, label: string) => { if (!str(b[field])) errors.push(label + " is required."); };
    need("senderName", "Sender name"); need("senderPhone", "Sender phone"); need("senderAddress", "Sender address");
    need("receiverName", "Receiver name"); need("receiverPhone", "Receiver phone"); need("receiverAddress", "Receiver address");
    need("originCity", "Origin city"); need("destinationCity", "Destination city");
    const shipmentType = SHIPMENT_TYPES.includes(str(b.shipmentType)) ? str(b.shipmentType) : "";
    if (!shipmentType) errors.push("Shipment type must be national or international.");
    const deliveryType = DELIVERY_TYPES.includes(str(b.deliveryType)) ? str(b.deliveryType) : "";
    if (!deliveryType) errors.push("Delivery type must be sameDay, overnight or standard.");
    const parcelCategory = CATEGORIES.includes(str(b.parcelCategory)) ? str(b.parcelCategory) : "";
    if (!parcelCategory) errors.push("Invalid parcel category.");
    const weight = Number(b.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) errors.push("Weight must be a positive number (kg).");
    if (shipmentType === "national" && !UGANDA_CITIES.includes(str(b.originCity)) && !UGANDA_REGION_NAMES.includes(str(b.originCity))) errors.push("Origin must be a valid Ugandan city or region.");
    if (shipmentType === "national" && str(b.originCity) === str(b.destinationCity)) errors.push("Origin and destination cities cannot be the same.");
    if (errors.length) throw new HttpError(400, errors[0]);
    const originCountry = str(b.originCountry) || "Uganda";
    const destinationCountry = str(b.destinationCountry) || originCountry;
    const { price, currency } = calculatePrice({ shipmentType, parcelCategory, weight, deliveryType, originCountry, destinationCountry });
    let trackingId = newTrackingId();
    for (let i = 0; i < 10; i += 1) {
      const exists = await ctx.db.query("parcels").withIndex("by_trackingId", (q: any) => q.eq("trackingId", trackingId)).first();
      if (!exists) break;
      trackingId = newTrackingId();
    }
    const nowIso = new Date().toISOString();
    const status = "arrived";
    const checkpoints = [checkpointRecord({
      status,
      location: str(b.originCity) || originCountry,
      message: "Shipment booked. Parcel received at origin facility.",
    })];
    const docId = await ctx.db.insert("parcels", {
      trackingId,
      senderName: str(b.senderName), senderPhone: str(b.senderPhone), senderAddress: str(b.senderAddress),
      receiverName: str(b.receiverName), receiverPhone: str(b.receiverPhone), receiverAddress: str(b.receiverAddress),
      shipmentType, originCity: str(b.originCity), destinationCity: str(b.destinationCity),
      originCountry, destinationCountry,
      deliveryType, parcelCategory, weight, price, currency, status,
      storeName: str(b.storeName) || null,
      memberId: str(b.memberId) || null,
      memberEmail: str(b.memberEmail) || null,
      createdAt: nowIso, updatedAt: nowIso, checkpoints,
    });
    const doc = await ctx.db.get(docId);
    return doc;
  },
});

// Admin: append a tracking event (mirrors POST /api/parcels/:id/checkpoint).
export const addCheckpoint = mutation({
  args: { token: v.union(v.null(), v.string()), id: v.string(), checkpoint: v.any() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const doc: any = await ctx.db.get(args.id as any);
    if (!doc) throw new HttpError(404, "Parcel not found.");
    const c = args.checkpoint ?? {};
    const cleanStatus = str(c.status);
    if (!STATUSES.includes(cleanStatus)) throw new HttpError(400, "Status must be one of: " + STATUSES.join(", ") + ".");
    if (!str(c.location)) throw new HttpError(400, "Checkpoint location is required.");
    if (!str(c.title)) throw new HttpError(400, "Checkpoint title is required.");
    const message = str(c.description) || str(c.title);
    const next = checkpointRecord({ status: cleanStatus, location: str(c.location), message });
    const checkpoints = [...(doc.checkpoints ?? []), next];
    await ctx.db.patch(doc._id, { status: cleanStatus, checkpoints, updatedAt: next.timestamp });
    const updated = await ctx.db.get(doc._id);
    return updated;
  },
});