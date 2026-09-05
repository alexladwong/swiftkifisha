import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { createAuth } from "./betterAuth/auth";
import { requireAdmin, HttpError } from "./lib/authz";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES } from "./lib/intl";

function toPublicUser(user: any, isAdmin: boolean) {
  return { _id: user.id, id: user.id, name: user.name, email: user.email, role: isAdmin ? "admin" : "member", createdAt: user.createdAt ?? new Date().toISOString() };
}

async function adminRole(ctx: any, email: string) {
  const admin = await ctx.db.query("admins").withIndex("by_email", (q: any) => q.eq("email", email)).first();
  return Boolean(admin);
}

// Bridge for the dashboard login form (mirrors POST /api/auth/login).
export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    let res: any = null;
    try {
      res = await auth.api.signInEmail({ body: { email: args.email, password: args.password } });
    } catch (err: any) {
      throw new HttpError(401, (err?.message ?? "Invalid email or password.").replace(/^.*?:\s*/, ""));
    }
    const user = res?.user;
    const token = res?.token ?? res?.session?.token;
    if (!user || !token) throw new HttpError(401, "Invalid email or password.");
    const isAdmin = await adminRole(ctx, user.email as string);
    const base: any = toPublicUser(user, isAdmin);
    if (!isAdmin) {
      // Attach the member profile (mailboxes, plan) when it exists.
      const profile = await ctx.db.query("members").withIndex("by_email", (q: any) => q.eq("email", user.email as string)).first();
      if (profile) {
        base.memberCode = profile.memberCode;
        base.plan = profile.plan;
        base.homeCountry = profile.homeCountry;
        base.homeCity = profile.homeCity;
        base.hubAddresses = profile.hubAddresses;
      }
    }
    return { message: "Logged in successfully", token, user: base };
  },
});

// Bridge for the Add Admin page (mirrors POST /api/auth/add-user).
export const addUser = mutation({
  args: { token: v.union(v.null(), v.string()), name: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "A valid email address is required.");
    if (!args.name?.trim()) throw new HttpError(400, "Name is required.");
    if (!args.password || args.password.length < 6) throw new HttpError(400, "Password must be at least 6 characters.");
    const auth = createAuth(ctx);
    let user: any = null;
    try {
      const existing = await ctx.db.query("admins").withIndex("by_email", (q: any) => q.eq("email", email)).first();
      if (existing) throw new HttpError(409, "An admin with this email already exists.");
      const res = await auth.api.signUpEmail({ body: { name: args.name.trim(), email, password: args.password } });
      user = res?.user;
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      if (/already exists/i.test(err?.message ?? "")) throw new HttpError(409, "An admin with this email already exists.");
      throw new HttpError(500, "Failed to create admin account.");
    }
    await ctx.db.insert("admins", { email, name: args.name.trim(), createdAt: new Date().toISOString() });
    return { message: "Admin created successfully", user: toPublicUser(user, true) };
  },
});

// Public member registration (mirrors POST /api/auth/signup on the Express backend).
export const signUp = mutation({
  args: { name: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!args.name?.trim()) throw new HttpError(400, "Name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "A valid email address is required.");
    if (!args.password || args.password.length < 6) throw new HttpError(400, "Password must be at least 6 characters.");
    const existing = await ctx.db.query("members").withIndex("by_email", (q: any) => q.eq("email", email)).first();
    if (existing) throw new HttpError(409, "An account with this email already exists.");
    const auth = createAuth(ctx);
    let res: any;
    try {
      res = await auth.api.signUpEmail({ body: { name: args.name.trim(), email, password: args.password } });
    } catch (err: any) {
      if (/already exists/i.test(err?.message ?? "")) throw new HttpError(409, "An account with this email already exists.");
      throw new HttpError(500, "Failed to create account.");
    }
    const user = res?.user;
    const token = res?.token;
    if (!user || !token) throw new HttpError(500, "Failed to create account.");
    const memberCode = "SP-" + Math.floor(10000 + Math.random() * 89999);
    const hubAddresses = ["United States", "United Kingdom"].map((country) => {
      const hub = HUB_COUNTRIES.find((h) => h.country === country);
      return {
        country,
        city: hub ? hub.city : country,
        suite: memberCode + "-" + (hub ? hub.code : "XX"),
        addressLines: HUB_MAILBOX_EXAMPLES[country] ?? [],
      };
    });
    await ctx.db.insert("members", {
      name: user.name as string,
      email,
      phone: "+256-700-000000",
      plan: "Saver",
      homeCountry: "Uganda",
      homeCity: "Kampala",
      address: "Kampala, Uganda",
      memberCode,
      joinedAt: new Date().toISOString(),
      hubAddresses,
    });
    return {
      message: "Account created successfully",
      token,
      user: {
        _id: user.id, id: user.id, name: user.name, email: user.email, role: "member",
        createdAt: user.createdAt ?? new Date().toISOString(),
        memberCode, plan: "Saver", homeCountry: "Uganda", homeCity: "Kampala", hubAddresses,
      },
    };
  },
});

// Member password change via Better Auth (session token-bound).
export const changePassword = mutation({
  args: { token: v.union(v.null(), v.string()), currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    if (!args.currentPassword || !args.newPassword || args.newPassword.length < 8) {
      throw new HttpError(400, "New password must be at least 8 characters.");
    }
    try {
      const auth = createAuth(ctx);
      await auth.api.changePassword({
        body: { currentPassword: args.currentPassword, newPassword: args.newPassword },
        headers: { authorization: "Bearer " + (args.token ?? "") },
      });
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (/password/i.test(msg)) throw new HttpError(400, "Current password is incorrect.");
      throw new HttpError(500, "Could not change password.");
    }
    return { message: "Password changed successfully" };
  },
});
