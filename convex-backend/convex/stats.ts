import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/authz";
import { toUgx } from "./lib/pricingFx";
import { statusDistribution, monthlyParcelSeries, monthlyRevenueSeries, weightDistribution, type AnyParcel } from "./lib/agg";

// Admin: dashboard cards + charts (mirrors GET /api/dashboard/stats).
// Mutation (not query): see comment in parcels.ts re component tables.
export const dashboard = mutation({
  args: { token: v.union(v.null(), v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const parcels = (await ctx.db.query("parcels").collect()) as any[] as AnyParcel[];
    const total = parcels.length;
    let revenueUSD = 0;
    for (const p of parcels) {
      if (p.currency === "USD") revenueUSD += Number(p.price) || 0;
    }
    return {
      totals: {
        parcels: total,
        international: parcels.filter((p) => p.shipmentType === "international").length,
        revenue: parcels.reduce((sum, p) => sum + toUgx(p.price, p.currency), 0),
        revenueUSD: Math.round(revenueUSD * 100) / 100,
      },
      statusDistribution: statusDistribution(parcels),
      monthlyParcels: monthlyParcelSeries(parcels),
      monthlyRevenue: monthlyRevenueSeries(parcels),
      weightDistribution: weightDistribution(parcels),
    };
  },
});