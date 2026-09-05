import { HUB_COUNTRIES, zoneForCountry, FX_UGX_PER_USD } from "./intl.js";
import { PARCEL_CATEGORIES } from "./referenceData.js";

/**
 * Domestic (Uganda) per-kg base rates in UGX by parcel category.
 */
const UGX_RATE_PER_KG = {
  document: 3500, small_package: 2500, large_package: 2000, books: 2600,
  clothing: 3000, food: 3300, cosmetics: 3600, electronics: 4500,
  fragile: 5200, medicine: 3800,
};
const UGX_HANDLING = 2000;
const UGX_DELIVERY_MULTIPLIER = { sameDay: 1.9, overnight: 1.35, standard: 1.0 };

/** Relative handling difficulty of a category (applies to intl per-kg). */
const CATEGORY_FACTOR = {
  document: 1.0, small_package: 1.0, large_package: 1.1, books: 1.0,
  clothing: 1.1, food: 1.25, cosmetics: 1.3, electronics: 1.5,
  fragile: 1.75, medicine: 1.25,
};
const INTL_DELIVERY_MULTIPLIER = { sameDay: 2.2, overnight: 1.45, standard: 1.0 };
const INTL_HANDLING = 8;
const INTL_MIN_TOTAL = 18;
const BULK_WEIGHT_KG = 15;
const BULK_DISCOUNT = 0.9;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Quote engine.
 * - Domestic ("national", origin+destination Uganda): UGX (Ugandan shillings).
 * - International shop-and-ship: USD = hub pickup fee + zone per-kg, by weight,
 *   category and delivery speed.
 * @returns {{price:number, currency:"UGX"|"USD"}}
 */
export function calculatePrice({ shipmentType = "national", parcelCategory = "small_package", weight = 1, deliveryType = "standard", originCountry = "Uganda", destinationCountry = "Uganda" }) {
  const category = PARCEL_CATEGORIES.includes(parcelCategory) ? parcelCategory : "small_package";
  const w = Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1;

  if (shipmentType !== "international") {
    const subtotal = UGX_RATE_PER_KG[category] * w * (UGX_DELIVERY_MULTIPLIER[deliveryType] || 1) + UGX_HANDLING;
    const discounted = w >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
    return { price: Math.max(2000, Math.round(discounted / 100) * 100), currency: "UGX" };
  }

  const hub = HUB_COUNTRIES.find((h) => h.country === originCountry);
  const pickup = hub ? hub.pickupFee : 14;
  const zone = zoneForCountry(destinationCountry);
  const base = pickup + zone.perKg * w * (CATEGORY_FACTOR[category] || 1) * (INTL_DELIVERY_MULTIPLIER[deliveryType] || 1);
  const subtotal = base + INTL_HANDLING;
  const discounted = w >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
  return { price: Math.max(INTL_MIN_TOTAL, round2(discounted)), currency: "USD" };
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