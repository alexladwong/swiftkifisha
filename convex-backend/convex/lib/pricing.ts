import { HUB_COUNTRIES, zonePerKg, CATEGORIES, ugandaDistanceKm } from "./intl";

// ---- Domestic (Uganda) components ----
const UGX_BASE_FEE = 2000;
const UGX_CONTENT_PER_KG: Record<string, number> = {
  document: 2500, small_package: 2200, large_package: 1800, books: 2000,
  clothing: 2400, food: 2600, cosmetics: 2800, electronics: 3200,
  fragile: 3800, medicine: 3000,
};
const UGX_DISTANCE_PER_KG_KM = 55;
const UGX_CONTENT_FACTOR: Record<string, number> = {
  document: 1.0, small_package: 1.0, large_package: 1.15, books: 1.0,
  clothing: 1.1, food: 1.25, cosmetics: 1.3, electronics: 1.5,
  fragile: 1.7, medicine: 1.25,
};
const UGX_DELIVERY_MULTIPLIER = { sameDay: 1.9, overnight: 1.35, standard: 1.0 } as Record<string, number>;
const MIN_BILLABLE_KG = 1;
const MIN_DOMESTIC_TOTAL = 2000;
const BULK_WEIGHT_KG = 15;
const BULK_DISCOUNT = 0.9;
const round100 = (n: number) => Math.round(n / 100) * 100;

// ---- International components ----
const CATEGORY_FACTOR: Record<string, number> = {
  document: 1, small_package: 1, large_package: 1.1, books: 1, clothing: 1.1, food: 1.25,
  cosmetics: 1.3, electronics: 1.5, fragile: 1.75, medicine: 1.25,
};
const INTL_MULT = { sameDay: 2.2, overnight: 1.45, standard: 1.0 } as Record<string, number>;
const INTL_HANDLING = 8;
const INTL_MIN = 18;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type QuoteInput = {
  shipmentType?: string; parcelCategory?: string; weight?: number; deliveryType?: string;
  originCountry?: string; destinationCountry?: string; originCity?: string; destinationCity?: string;
};

export type QuoteResult = {
  price: number; currency: string;
  distanceKm?: number | null;
  billableWeight: number;
  breakdown?: {
    baseFee: number; contentFee: number; distanceFee: number;
    deliveryMultiplier: number; bulkDiscountApplied: boolean;
  } | null;
};

export function calculateQuote(input: QuoteInput): QuoteResult {
  const shipmentType = input.shipmentType === "international" ? "international" : "national";
  const category = CATEGORIES.includes(input.parcelCategory ?? "") ? input.parcelCategory! : "small_package";
  const inputWeight = Number.isFinite(input.weight) && (input.weight ?? 0) > 0 ? input.weight! : 1;
  const billableWeight = Math.max(MIN_BILLABLE_KG, inputWeight);
  const deliveryType = input.deliveryType && input.deliveryType in UGX_DELIVERY_MULTIPLIER ? input.deliveryType : "standard";

  if (shipmentType !== "international") {
    const distanceKm = ugandaDistanceKm(input.originCity ?? "", input.destinationCity ?? "");
    const contentFee = Math.round((UGX_CONTENT_PER_KG[category] ?? 2200) * billableWeight);
    const distanceFee = distanceKm === null ? 0 : Math.round(distanceKm * billableWeight * UGX_DISTANCE_PER_KG_KM);
    const subtotal = (UGX_BASE_FEE + contentFee + distanceFee) * UGX_DELIVERY_MULTIPLIER[deliveryType];
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
        deliveryMultiplier: UGX_DELIVERY_MULTIPLIER[deliveryType],
        bulkDiscountApplied: billableWeight >= BULK_WEIGHT_KG,
      },
    };
  }

  const origin = input.originCountry && input.originCountry.length ? input.originCountry : "United States";
  const hub = HUB_COUNTRIES.find((h) => h.country === origin);
  const pickup = hub ? hub.pickupFee : 14;
  const dest = input.destinationCountry && input.destinationCountry.length ? input.destinationCountry : "United States";
  const base = pickup + zonePerKg(dest) * billableWeight * (CATEGORY_FACTOR[category] ?? 1) * INTL_MULT[deliveryType];
  const subtotal = base + INTL_HANDLING;
  const discounted = billableWeight >= BULK_WEIGHT_KG ? subtotal * BULK_DISCOUNT : subtotal;
  return {
    price: Math.max(INTL_MIN, round2(discounted)),
    currency: "USD",
    billableWeight,
  };
}

/** Legacy wrapper for callers that only need { price, currency }. */
export function calculatePrice(input: QuoteInput): { price: number; currency: string } {
  const q = calculateQuote(input);
  return { price: q.price, currency: q.currency };
}
