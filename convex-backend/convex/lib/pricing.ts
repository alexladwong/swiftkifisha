import { HUB_COUNTRIES, zonePerKg, CATEGORIES } from "./intl";

const UGX_RATE_PER_KG: Record<string, number> = {
  document: 3500, small_package: 2500, large_package: 2000, books: 2600, clothing: 3000,
  food: 3300, cosmetics: 3600, electronics: 4500, fragile: 5200, medicine: 3800,
};
const UGX_HANDLING = 2000;
const UGX_MULT = { sameDay: 1.9, overnight: 1.35, standard: 1.0 } as Record<string, number>;
const CATEGORY_FACTOR: Record<string, number> = {
  document: 1, small_package: 1, large_package: 1.1, books: 1, clothing: 1.1, food: 1.25,
  cosmetics: 1.3, electronics: 1.5, fragile: 1.75, medicine: 1.25,
};
const INTL_MULT = { sameDay: 2.2, overnight: 1.45, standard: 1.0 } as Record<string, number>;
const INTL_HANDLING = 8;
const INTL_MIN = 18;
const BULK_KG = 15;
const BULK_DISCOUNT = 0.9;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type QuoteInput = {
  shipmentType?: string; parcelCategory?: string; weight?: number; deliveryType?: string;
  originCountry?: string; destinationCountry?: string;
};

export function calculatePrice(input: QuoteInput): { price: number; currency: string } {
  const shipmentType = input.shipmentType === "international" ? "international" : "national";
  const category = CATEGORIES.includes(input.parcelCategory ?? "") ? input.parcelCategory! : "small_package";
  const w = Number.isFinite(input.weight) && (input.weight ?? 0) > 0 ? input.weight! : 1;
  const deliveryType = input.deliveryType && input.deliveryType in UGX_MULT ? input.deliveryType : "standard";
  if (shipmentType !== "international") {
    const subtotal = UGX_RATE_PER_KG[category] * w * UGX_MULT[deliveryType] + UGX_HANDLING;
    const discounted = w >= BULK_KG ? subtotal * BULK_DISCOUNT : subtotal;
    return { price: Math.max(2000, Math.round(discounted / 100) * 100), currency: "UGX" };
  }
  const origin = input.originCountry && input.originCountry.length ? input.originCountry : "United States";
  const hub = HUB_COUNTRIES.find((h) => h.country === origin);
  const pickup = hub ? hub.pickupFee : 14;
  const dest = input.destinationCountry && input.destinationCountry.length ? input.destinationCountry : "United States";
  // Evaluation order intentionally mirrors backend/src/lib/pricing.js so
  // floating point rounding produces byte-identical quotes:
  // pickup + zone * weight * categoryFactor * deliveryMultiplier
  const base = pickup + zonePerKg(dest) * w * (CATEGORY_FACTOR[category] ?? 1) * INTL_MULT[deliveryType];
  const discounted = w >= BULK_KG ? (base + INTL_HANDLING) * BULK_DISCOUNT : base + INTL_HANDLING;
  return { price: Math.max(INTL_MIN, round2(discounted)), currency: "USD" };
}