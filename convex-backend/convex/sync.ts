import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { checkpointSchema, hubAddressSchema } from "./lib/types";

// One-time dataset sync helpers used by scripts/import-express-data.mjs to
// mirror the Express/Neon store (members + parcels) into this deployment.
// Auth users/admins are intentionally NOT imported (Better Auth manages those).

const memberFields = {
  name: v.string(),
  email: v.string(),
  phone: v.string(),
  plan: v.string(),
  homeCountry: v.string(),
  homeCity: v.string(),
  address: v.string(),
  memberCode: v.string(),
  joinedAt: v.string(),
  hubAddresses: v.array(hubAddressSchema),
};

const parcelFields = {
  trackingId: v.string(),
  senderName: v.string(),
  senderPhone: v.string(),
  senderAddress: v.string(),
  receiverName: v.string(),
  receiverPhone: v.string(),
  receiverAddress: v.string(),
  shipmentType: v.string(),
  originCity: v.string(),
  destinationCity: v.string(),
  originCountry: v.string(),
  destinationCountry: v.string(),
  deliveryType: v.string(),
  parcelCategory: v.string(),
  weight: v.number(),
  price: v.number(),
  currency: v.string(),
  status: v.string(),
  storeName: v.optional(v.union(v.null(), v.string())),
  memberId: v.optional(v.union(v.null(), v.string())),
  memberEmail: v.optional(v.union(v.null(), v.string())),
  createdAt: v.string(),
  updatedAt: v.string(),
  checkpoints: v.array(checkpointSchema),
};

/** Replaces every member row and returns { email: newId } for remapping. */
export const importMembers = mutation({
  args: { members: v.array(v.object(memberFields)) },
  handler: async (ctx, { members }) => {
    const existing = await ctx.db.query("members").collect();
    for (const row of existing) await ctx.db.delete(row._id);
    const byEmail: Record<string, string> = {};
    for (const row of members) {
      const id = await ctx.db.insert("members", row);
      byEmail[row.email.toLowerCase()] = id;
    }
    return byEmail;
  },
});

/** Removes every parcel row (call once before importing the new dataset). */
export const clearParcels = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("parcels").collect();
    for (const row of existing) await ctx.db.delete(row._id);
    return { cleared: existing.length };
  },
});

/** Appends a batch of parcel rows (memberId already remapped by the script). */
export const importParcels = mutation({
  args: { parcels: v.array(v.object(parcelFields)) },
  handler: async (ctx, { parcels }) => {
    let inserted = 0;
    for (const row of parcels) {
      await ctx.db.insert("parcels", row);
      inserted += 1;
    }
    return { inserted };
  },
});
