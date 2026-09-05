import { v } from "convex/values";

export const checkpointSchema = v.object({
  status: v.string(),
  location: v.string(),
  message: v.string(),
  timestamp: v.string(),
  timestamps: v.string(),
  dateTime: v.string(),
});

export const hubAddressSchema = v.object({
  country: v.string(),
  city: v.string(),
  suite: v.string(),
  addressLines: v.array(v.string()),
});
