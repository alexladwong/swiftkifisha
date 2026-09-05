import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { createAuth } from "./betterAuth/auth";
import { HttpError } from "./lib/authz";

// One-off admin tool: ensures a Better Auth user exists and marks the email as
// an admin (admins table). Run: npx convex run admin:upsertAdmin '{...}'
export const upsertAdmin = mutation({
  args: { name: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const auth = createAuth(ctx);
    let created = false;
    try {
      await auth.api.signUpEmail({ body: { name: args.name.trim(), email, password: args.password } });
      created = true;
    } catch (err: any) {
      if (!/already exists/i.test(err?.message ?? "")) {
        throw new HttpError(500, "Failed to create auth user: " + (err?.message ?? ""));
      }
    }
    const admin = await ctx.db.query("admins").withIndex("by_email", (q: any) => q.eq("email", email)).first();
    if (!admin) {
      await ctx.db.insert("admins", { email, name: args.name.trim(), createdAt: new Date().toISOString() });
    }
    return { email, created, alreadyAdmin: Boolean(admin) };
  },
});
