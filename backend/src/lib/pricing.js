import { HUB_COUNTRIES, zoneForCountry, FX_PKR_PER_USD } from "./intl.js";
import { PARCEL_CATEGORIES } from "./referenceData.js";

/**
 * Domestic (Pakistan) per-kg base rates in PKR by parcel category.
 */
const PKR_RATE_PER_KG = {
  document: 250, small_package: 180, large_package: 150, books: 190,
  clothing: 220, food: 240, cosmetics: 260, electronics: 320,
  fragile: 380, medicine: 270,
};
const PKR_HANDLING = 150;
const PKR_DELIVERY_MULTIPLIER = { sameDay: 1.9, overnight: 1.35, standard: 1.0 };

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
 * - Domestic ("national", origin+destination Pakistan): PKR (legacy table).
 * - International shop-and-ship: USD = hub pickup fee + zone per-kg, by weight,
 *   category and delivery speed.
 * @returns {{price:number, currency:"PKR"|"USD"}}
 */
export function calculatePrice({ shipmentType = "national", parcelCategory = "small_package", weight = 1, deliveryType = "standard", originCountry = "Pakistan", destinationCountry = "Pakistan" }) {
  const category = PARCEL_CATEGORIES.includes(parcelCategory) ? parcelCategory : "small_package";
  const w = Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1;

  if (shipmentType !== "international") {
    const subtotal = PKR_RATE_PER_KG[category] * w * (PKR_DELIVERY_MULTIPLIER[deliveryType] || 1) + PKR_HANDLING;
    const discounted = w >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
    return { price: Math.max(50, Math.round(discounted / 10) * 10), currency: "PKR" };
  }

  const hub = HUB_COUNTRIES.find((h) => h.country === originCountry);
  const pickup = hub ? hub.pickupFee : 14;
  const zone = zoneForCountry(destinationCountry);
  const base = pickup + zone.perKg * w * (CATEGORY_FACTOR[category] || 1) * (INTL_DELIVERY_MULTIPLIER[deliveryType] || 1);
  const subtotal = base + INTL_HANDLING;
  const discounted = w >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
  return { price: Math.max(INTL_MIN_TOTAL, round2(discounted)), currency: "USD" };
}

/** To keep dashboard/analytics charts single-currency, convert USD -> PKR. */
export function toPkr(amount, currency) {
  return currency === "USD" ? Math.round(Number(amount) * FX_PKR_PER_USD) : Number(amount);
}

/** Delivery target (days) used for on-time analytics. */
export function deliveryTargetDays({ shipmentType, deliveryType }) {
  if (shipmentType === "international") {
    return { standard: 7, overnight: 3, sameDay: 1 }[deliveryType] ?? 7;
  }
  return { sameDay: 1, overnight: 1, standard: 3 }[deliveryType] ?? 3;
}
