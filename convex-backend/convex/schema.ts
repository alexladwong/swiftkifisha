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

  // One-time password-reset tokens (email + opaque token, 60 min TTL).
  resetTokens: defineTable({
    email: v.string(),
    token: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  // Communications sync (mirrors the Express/Neon store).
  applications: defineTable({
    refId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    homeCountry: v.string(),
    message: v.string(),
    status: v.string(),
    note: v.string(),
    reviewedBy: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_email", ["email"]),

  messages: defineTable({
    refId: v.string(),
    email: v.string(),
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    direction: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  }).index("by_email", ["email"]),

  announcements: defineTable({
    refId: v.string(),
    title: v.string(),
    body: v.string(),
    type: v.string(),
    audience: v.string(),
    region: v.string(),
    createdBy: v.string(),
    createdAt: v.string(),
  }).index("by_createdAt", ["createdAt"]),

  // Admin passwordless sign-in codes (email + hashed 6-digit OTP, 5 min TTL).
  adminOtps: defineTable({
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
    lastSentAt: v.string(),
    attempts: v.number(),
  }).index("by_email", ["email"]),

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