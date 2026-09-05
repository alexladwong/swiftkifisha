import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { checkpointSchema, hubAddressSchema } from "./lib/types";

export default defineSchema({
  admins: defineTable({
    email: v.string(),
    name: v.string(),
    createdAt: v.string(),
  }).index("by_email", ["email"]),

  members: defineTable({
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
  })
    .index("by_email", ["email"])
    .index("by_memberCode", ["memberCode"]),

  parcels: defineTable({
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
  })
    .index("by_trackingId", ["trackingId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_memberId", ["memberId"])
    .index("by_originCountry", ["originCountry"])
    .index("by_destinationCountry", ["destinationCountry"]),
});
