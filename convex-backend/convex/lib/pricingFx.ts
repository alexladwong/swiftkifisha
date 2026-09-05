export const FX_UGX_PER_USD = 3700;
export function toUgx(amount: number, currency?: string | null): number {
  return currency === "USD" ? Math.round(amount * FX_UGX_PER_USD) : Number(amount) || 0;
}
export function targetDays(shipmentType?: string, deliveryType?: string): number {
  if (shipmentType === "international") {
    return { standard: 7, overnight: 3, sameDay: 1 }[deliveryType ?? "standard"] ?? 7;
  }
  return { sameDay: 1, overnight: 1, standard: 3 }[deliveryType ?? "standard"] ?? 3;
}