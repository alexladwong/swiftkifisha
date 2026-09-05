import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin, requireMember } from "./lib/authz";
import { toUgx } from "./lib/pricingFx";
import { createAuth } from "./betterAuth/auth";
import type { AnyParcel } from "./lib/agg";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function memberStats(member: { _id: string }, parcels: any[]) {
  const mine = parcels.filter((p) => p.memberId === member._id);
  const totals = mine.reduce(
    (acc, p) => ({
      parcels: acc.parcels + 1,
      international: acc.international + (p.shipmentType === "international" ? 1 : 0),
      delivered: acc.delivered + ((p.checkpoints ?? []).some((c: any) => c.status === "delivered") ? 1 : 0),
      revenuePkr: acc.revenuePkr + toUgx(p.price, p.currency),
      revenueUSD: acc.revenueUSD + (p.currency === "USD" ? Number(p.price) || 0 : 0),
    }),
    { parcels: 0, international: 0, delivered: 0, revenuePkr: 0, revenueUSD: 0 },
  );
  totals.revenueUSD = Math.round(totals.revenueUSD * 100) / 100;
  const last = mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return { totals, lastShipmentAt: last?.createdAt ?? null };
}

// Admin: members with shipment totals (mirrors GET /api/members).
// Mutation (not query): see comment in parcels.ts re component tables.
export const list = mutation({
  args: {
    token: v.union(v.null(), v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const page = clamp(Number(args.page) || 1, 1, 100000);
    const limit = clamp(Number(args.limit) || 20, 1, 100);
    const search = (args.search ?? "").trim().toLowerCase();
    const [members, parcels] = await Promise.all([
      ctx.db.query("members").collect(),
      ctx.db.query("parcels").collect(),
    ]);
    let rows = members.map((m) => {
      const s = memberStats(m, parcels);
      return {
        _id: m._id, name: m.name, email: m.email, phone: m.phone, plan: m.plan,
        memberCode: m.memberCode, homeCountry: m.homeCountry, homeCity: m.homeCity, joinedAt: m.joinedAt,
        hubAddresses: m.hubAddresses, totals: s.totals, lastShipmentAt: s.lastShipmentAt,
      };
    });
    if (search) {
      rows = rows.filter((m) =>
        m.name.toLowerCase().includes(search) || m.email.toLowerCase().includes(search)
        || m.memberCode.toLowerCase().includes(search) || m.homeCountry.toLowerCase().includes(search),
      );
    }
    rows.sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    return { data: rows.slice((safePage - 1) * limit, safePage * limit), page: safePage, limit, total, totalPages };
  },
});

// Admin: member profile + recent parcels (mutation for component-table auth).
export const detail = mutation({
  args: { token: v.union(v.null(), v.string()), id: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const member = await ctx.db.query("members").filter((q: any) => q.eq(q.field("_id"), args.id as any)).first();
    if (!member) return null;
    const parcels = await ctx.db.query("parcels").withIndex("by_memberId", (q: any) => q.eq("memberId", args.id)).collect();
    parcels.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { member, parcels: parcels.slice(0, 25) };
  },
});

// Member portal (token-bound to their own profile/shipments).
// Mutations (not queries): Better Auth session validation needs component-table reads.
export const me = mutation({
  args: { token: v.union(v.null(), v.string()) },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.token);
    return { member };
  },
});

export const myParcels = mutation({
  args: { token: v.union(v.null(), v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.token);
    const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
    const rows = (await ctx.db.query("parcels").collect())
      .filter((p) => p.memberId === member._id || p.memberEmail === member.email)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { data: rows.slice(0, limit), total: rows.length, limit };
  },
});

export const updateMe = mutation({
  args: { token: v.union(v.null(), v.string()), name: v.optional(v.string()), phone: v.optional(v.string()), homeCity: v.optional(v.string()), homeCountry: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { member, user } = await requireMember(ctx, args.token);
    const patch: any = {};
    if (args.name !== undefined && String(args.name).trim()) patch.name = String(args.name).trim();
    if (args.phone !== undefined && String(args.phone).trim()) patch.phone = String(args.phone).trim();
    if (args.homeCity !== undefined && String(args.homeCity).trim()) patch.homeCity = String(args.homeCity).trim();
    if (args.homeCountry !== undefined && String(args.homeCountry).trim()) patch.homeCountry = String(args.homeCountry).trim();
    if (Object.keys(patch).length) await ctx.db.patch(member._id, patch);
    // Keep the Better Auth display name in sync (best effort).
    if (patch.name) {
      try {
        const auth = createAuth(ctx);
        await auth.api.updateUser({ body: { name: patch.name }, headers: { authorization: "Bearer " + (args.token ?? "") } });
      } catch { /* non-fatal: member row is source of truth for the portal */ }
    }
    const updated = await ctx.db.get(member._id);
    return { message: "Profile updated successfully", member: updated };
  },
});