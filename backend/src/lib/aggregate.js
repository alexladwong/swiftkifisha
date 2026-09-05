import { deliveryTargetDays, toUgx } from "./pricing.js";
import { lastMonths, monthOf } from "./util.js";

const STATUS_KEYS = ["arrived", "in_transit", "out_for_delivery", "delivered"];

/** Latest checkpoint status (dashboard convention: "arrived" when none yet). */
export function currentStatusOf(parcel) {
  const cps = parcel?.checkpoints || [];
  return cps.length ? cps[cps.length - 1].status : "arrived";
}

/** [{name, value}] over the four canonical statuses. */
export function statusDistribution(parcels) {
  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  for (const p of parcels) {
    const s = currentStatusOf(p);
    if (s in counts) counts[s] += 1;
  }
  return STATUS_KEYS.map((name) => ({ name, value: counts[name] }));
}

/** [{month, parcels}] for the last 6 calendar months (oldest first, zero-filled). */
export function monthlyParcelSeries(parcels) {
  const months = lastMonths(6);
  const map = Object.fromEntries(months.map((m) => [m.key, 0]));
  for (const p of parcels) {
    const m = monthOf(p.createdAt);
    if (m.key in map) map[m.key] += 1;
  }
  return months.map((m) => ({ month: m.label, parcels: map[m.key] }));
}

/** [{month, revenue}] UGX revenue for the last 6 calendar months (USD converted at FX). */
export function monthlyRevenueSeries(parcels) {
  const months = lastMonths(6);
  const map = Object.fromEntries(months.map((m) => [m.key, 0]));
  for (const p of parcels) {
    const m = monthOf(p.createdAt);
    if (m.key in map) map[m.key] += toUgx(p.price, p.currency);
  }
  return months.map((m) => ({ month: m.label, revenue: map[m.key] }));
}

/** [{range, count}] for 0-1, 1-2, 2-5, 5-10, 10+ kg buckets. */
export function weightDistribution(parcels) {
  const buckets = [
    { range: "0-1 kg", min: 0, max: 1, count: 0 },
    { range: "1-2 kg", min: 1, max: 2, count: 0 },
    { range: "2-5 kg", min: 2, max: 5, count: 0 },
    { range: "5-10 kg", min: 5, max: 10, count: 0 },
    { range: "10+ kg", min: 10, max: Infinity, count: 0 },
  ];
  for (const p of parcels) {
    const w = Number(p.weight) || 0;
    const b = buckets.find((x) => w >= x.min && w < x.max) || buckets[buckets.length - 1];
    b.count += 1;
  }
  return buckets.map(({ range, count }) => ({ range, count }));
}

/** Top destination cities by parcel volume. */
export function topDestinationCities(parcels, limit = 5) {
  const counts = new Map();
  for (const p of parcels) {
    counts.set(p.destinationCity, (counts.get(p.destinationCity) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([city, parcels]) => ({ city, parcels }));
}

/**
 * [{month, onTime, delayed}] percentages over the last 6 months.
 * A parcel is on-time when delivered within its target window, or when it is
 * still travelling but within the window. Late deliveries and overdue parcels
 * count as delayed.
 */
export function deliveryPerformance(parcels, now = new Date()) {
  const months = lastMonths(6, now);
  const buckets = Object.fromEntries(months.map((m) => [m.key, { total: 0, onTime: 0 }]));
  for (const p of parcels) {
    const m = monthOf(p.createdAt);
    const b = buckets[m.key];
    if (!b) continue;
    const targetMs = deliveryTargetDays({ shipmentType: p.shipmentType, deliveryType: p.deliveryType }) * 86400000;
    const etaMs = new Date(p.createdAt).getTime() + targetMs;
    const deliveredCp = [...(p.checkpoints || [])].reverse().find((c) => c.status === "delivered");
    const deliveredMs = deliveredCp ? new Date(deliveredCp.timestamp).getTime() : null;
    b.total += 1;
    const onTime = deliveredMs ? deliveredMs <= etaMs : now.getTime() <= etaMs;
    if (onTime) b.onTime += 1;
  }
  return months.map((m) => {
    const b = buckets[m.key];
    const onTime = b.total ? Math.round((b.onTime / b.total) * 100) : 0;
    return { month: m.label, onTime, delayed: 100 - onTime };
  });
}