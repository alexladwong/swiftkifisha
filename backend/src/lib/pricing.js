import { HUB_COUNTRIES, zoneForCountry, FX_UGX_PER_USD } from "./intl.js";
import { PARCEL_CATEGORIES, ugandaDistanceKm } from "./referenceData.js";

/**
 * Domestic (Uganda) pricing components.
 * - baseFee: booking & handling per shipment (UGX)
 * - content rates: per kg by what the parcel contains (UGX)
 * - distance: straight-line km between Ugandan places x billable kg x rate
 * - minimum billable weight: 1 kg (light items under 1 kg are billed at 1 kg)
 * - delivery-speed multiplier applies to the whole domestic total
 */
const UGX_BASE_FEE = 2000;
const UGX_CONTENT_PER_KG = {
  document: 2500, small_package: 2200, large_package: 1800, books: 2000,
  clothing: 2400, food: 2600, cosmetics: 2800, electronics: 3200,
  fragile: 3800, medicine: 3000,
};
const UGX_DISTANCE_PER_KG_KM = 55;
const UGX_CONTENT_FACTOR = {
  document: 1.0, small_package: 1.0, large_package: 1.15, books: 1.0,
  clothing: 1.1, food: 1.25, cosmetics: 1.3, electronics: 1.5,
  fragile: 1.7, medicine: 1.25,
};
const UGX_DELIVERY_MULTIPLIER = { sameDay: 1.9, overnight: 1.35, standard: 1.0 };
const MIN_BILLABLE_KG = 1;
const MIN_DOMESTIC_TOTAL = 2000;
const BULK_WEIGHT_KG = 15;
const BULK_DISCOUNT = 0.9;
const round100 = (n) => Math.round(n / 100) * 100;

/** Relative handling difficulty of a category (applies to intl per-kg). */
const CATEGORY_FACTOR = {
  document: 1.0, small_package: 1.0, large_package: 1.1, books: 1.0,
  clothing: 1.1, food: 1.25, cosmetics: 1.3, electronics: 1.5,
  fragile: 1.75, medicine: 1.25,
};
const INTL_DELIVERY_MULTIPLIER = { sameDay: 2.2, overnight: 1.45, standard: 1.0 };
const INTL_HANDLING = 8;
const INTL_MIN_TOTAL = 18;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Full quote engine. Domestic quotes are distance + content based; every
 * quote reports its billable weight and, for Uganda routes, the distance and
 * a component breakdown.
 */
export function calculateQuote({
  shipmentType = "national", parcelCategory = "small_package", weight = 1,
  deliveryType = "standard", originCountry = "Uganda", destinationCountry = "Uganda",
  originCity = "", destinationCity = "",
}) {
  const category = PARCEL_CATEGORIES.includes(parcelCategory) ? parcelCategory : "small_package";
  const inputWeight = Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1;
  const billableWeight = Math.max(MIN_BILLABLE_KG, inputWeight);
  const deliveryTypeNorm = UGX_DELIVERY_MULTIPLIER[deliveryType] ? deliveryType : "standard";

  if (shipmentType !== "international") {
    const distanceKm = ugandaDistanceKm(originCity, destinationCity);
    const contentFee = Math.round((UGX_CONTENT_PER_KG[category] || 2200) * billableWeight);
    const distanceFee = distanceKm === null ? 0 : Math.round(distanceKm * billableWeight * UGX_DISTANCE_PER_KG_KM);
    const subtotal = (UGX_BASE_FEE + contentFee + distanceFee) * (UGX_DELIVERY_MULTIPLIER[deliveryTypeNorm] || 1);
    const discounted = billableWeight >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
    return {
      price: Math.max(MIN_DOMESTIC_TOTAL, round100(discounted)),
      currency: "UGX",
      distanceKm,
      billableWeight,
      breakdown: {
        baseFee: UGX_BASE_FEE,
        contentFee,
        distanceFee,
        deliveryMultiplier: UGX_DELIVERY_MULTIPLIER[deliveryTypeNorm] || 1,
        bulkDiscountApplied: billableWeight >= BULK_WEIGHT_KG,
      },
    };
  }

  const hub = HUB_COUNTRIES.find((h) => h.country === originCountry);
  const pickup = hub ? hub.pickupFee : 14;
  const zone = zoneForCountry(destinationCountry);
  const base = pickup + zone.perKg * billableWeight * (CATEGORY_FACTOR[category] || 1) * (INTL_DELIVERY_MULTIPLIER[deliveryTypeNorm] || 1);
  const subtotal = base + INTL_HANDLING;
  const discounted = billableWeight >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
  return {
    price: Math.max(INTL_MIN_TOTAL, round2(discounted)),
    currency: "USD",
    billableWeight,
  };
}

/** Legacy wrapper for callers that only need { price, currency }. */
export function calculatePrice(input) {
  const q = calculateQuote(input);
  return { price: q.price, currency: q.currency };
}

/** To keep dashboard/analytics charts single-currency, convert USD -> UGX. */
export function toUgx(amount, currency) {
  return currency === "USD" ? Math.round(Number(amount) * FX_UGX_PER_USD) : Number(amount);
}

/** Delivery target (days) used for on-time analytics. */
export function deliveryTargetDays({ shipmentType, deliveryType }) {
  if (shipmentType === "international") {
    return { standard: 7, overnight: 3, sameDay: 1 }[deliveryType] ?? 7;
  }
  return { sameDay: 1, overnight: 1, standard: 3 }[deliveryType] ?? 3;
}
