import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/authz";
import { toUgx } from "./lib/pricingFx";
import { monthlyParcelSeries as parcelSeries, monthlyRevenueSeries as revenueSeries, topDestinationCities as topCitiesSeries, deliveryPerformance as perfSeries, type AnyParcel } from "./lib/agg";

const adminArgs = { token: v.union(v.null(), v.string()) };

export const summary = mutation({
  args: adminArgs,
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const rows = (await ctx.db.query("parcels").collect()) as any[] as AnyParcel[];
    let revenueUSD = 0;
    for (const p of rows) { if (p.currency === "USD") revenueUSD += Number(p.price) || 0; }
    return {
      totals: {
        parcels: rows.length,
        international: rows.filter((p) => p.shipmentType === "international").length,
        revenue: rows.reduce((sum, p) => sum + toUgx(p.price, p.currency), 0),
        revenueUSD: Math.round(revenueUSD * 100) / 100,
      },
      citiesServed: new Set(rows.map((p) => p.destinationCountry || p.destinationCity)).size,
    };
  },
});

export const revenue = mutation({ args: adminArgs, handler: async (ctx, args) => {
  await requireAdmin(ctx, args.token);
  const rows = (await ctx.db.query("parcels").collect()) as any[] as AnyParcel[];
  return revenueSeries(rows);
} });

export const growth = mutation({ args: adminArgs, handler: async (ctx, args) => {
  await requireAdmin(ctx, args.token);
  const rows = (await ctx.db.query("parcels").collect()) as any[] as AnyParcel[];
  return parcelSeries(rows);
} });

export const topCities = mutation({ args: adminArgs, handler: async (ctx, args) => {
  await requireAdmin(ctx, args.token);
  const rows = (await ctx.db.query("parcels").collect()) as any[] as AnyParcel[];
  return topCitiesSeries(rows, 5);
} });

export const deliveryPerformance = mutation({ args: adminArgs, handler: async (ctx, args) => {
  await requireAdmin(ctx, args.token);
  const rows = (await ctx.db.query("parcels").collect()) as any[] as AnyParcel[];
  return perfSeries(rows);
} });