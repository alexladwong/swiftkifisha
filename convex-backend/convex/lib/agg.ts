// Aggregations mirroring backend/src/lib/aggregate.js over the parcels table.
import { toUgx, targetDays } from "./pricingFx";

export type AnyParcel = {
  createdAt: string; price: number; currency?: string | null; shipmentType?: string;
  deliveryType?: string; destinationCity?: string; destinationCountry?: string; checkpoints: { status: string; timestamp: string }[];
  weight?: number;
};

export const currentStatus = (p: AnyParcel) => {
  return p.checkpoints.length ? p.checkpoints[p.checkpoints.length - 1].status : "arrived";
};

const STATUS_KEYS = ["arrived", "in_transit", "out_for_delivery", "delivered"];
export function statusDistribution(parcels: AnyParcel[]) {
  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as Record<string, number>;
  for (const p of parcels) {
    const s = currentStatus(p);
    if (s in counts) counts[s] += 1;
  }
  return STATUS_KEYS.map((name) => ({ name, value: counts[name] }));
}

export function lastMonthKeys(n = 6, now = new Date()) {
  const out: { key: string; label: string; year: number; monthIndex: number }[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), monthIndex: d.getMonth(), key: d.getFullYear() + "-" + d.getMonth(), label: d.toLocaleString("en-US", { month: "short" }) });
  }
  return out;
}

export function monthKeyOf(iso: string) {
  const d = new Date(iso);
  return d.getFullYear() + "-" + d.getMonth();
}

export function monthlyParcelSeries(parcels: AnyParcel[]) {
  const months = lastMonthKeys(6);
  const map = Object.fromEntries(months.map((m) => [m.key, 0])) as Record<string, number>;
  for (const p of parcels) {
    const k = monthKeyOf(p.createdAt);
    if (k in map) map[k] += 1;
  }
  return months.map((m) => ({ month: m.label, parcels: map[m.key] }));
}

export function monthlyRevenueSeries(parcels: AnyParcel[]) {
  const months = lastMonthKeys(6);
  const map = Object.fromEntries(months.map((m) => [m.key, 0])) as Record<string, number>;
  for (const p of parcels) {
    const k = monthKeyOf(p.createdAt);
    if (k in map) map[k] += toUgx(p.price, p.currency);
  }
  return months.map((m) => ({ month: m.label, revenue: map[m.key] }));
}

export function weightDistribution(parcels: AnyParcel[]) {
  const buckets = [{ range: "0-1 kg", min: 0, max: 1 }, { range: "1-2 kg", min: 1, max: 2 }, { range: "2-5 kg", min: 2, max: 5 }, { range: "5-10 kg", min: 5, max: 10 }, { range: "10+ kg", min: 10, max: Infinity }];
  const counts = buckets.map((b) => ({ ...b, count: 0 }));
  for (const p of parcels) {
    const w = Number(p.weight) || 0;
    const b = counts.find((x) => w >= x.min && w < x.max) || counts[counts.length - 1];
    b.count += 1;
  }
  return counts.map(({ range, count }) => ({ range, count }));
}

export function topDestinationCities(parcels: AnyParcel[], limit = 5) {
  const counts = new Map<string, number>();
  for (const p of parcels) {
    counts.set(p.destinationCity, (counts.get(p.destinationCity) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([city, count]) => ({ city, parcels: count }));
}

export function deliveryPerformance(parcels: AnyParcel[], now = new Date()) {
  const months = lastMonthKeys(6, now);
  const buckets = Object.fromEntries(months.map((m) => [m.key, { total: 0, onTime: 0 }])) as Record<string, { total: number; onTime: number }>;
  for (const p of parcels) {
    const b = buckets[monthKeyOf(p.createdAt)];
    if (!b) continue;
    const eta = new Date(p.createdAt).getTime() + targetDays(p.shipmentType, p.deliveryType) * 86400000;
    const delivered = [...p.checkpoints].reverse().find((c) => c.status === "delivered");
    const deliveredMs = delivered ? new Date(delivered.timestamp).getTime() : null;
    b.total += 1;
    const onTime = deliveredMs ? deliveredMs <= eta : now.getTime() <= eta;
    if (onTime) b.onTime += 1;
  }
  return months.map((m) => {
    const b = buckets[m.key];
    const onTime = b.total ? Math.round((b.onTime / b.total) * 100) : 0;
    return { month: m.label, onTime, delayed: 100 - onTime };
  });
}