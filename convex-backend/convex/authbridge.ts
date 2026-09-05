import { v } from "convex/values";
import { hashPassword } from "better-auth/crypto";
import { mutation } from "./_generated/server";
import { createAuth } from "./betterAuth/auth";
import { components } from "./_generated/api";
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

// ---------------------------------------------------------------------------
// Password reset (one-time token, 60 min) — mirrors the Express API contract.
//
// Delivery: no SMTP/email provider is configured yet, so the reset link is
// written to the function log and — while it is safe to do so (local dev or
// RESET_LINK_DEBUG=true) — returned as `devResetLink` so a demo account can be
// recovered without an inbox. Swap this for Resend/SMTP when email goes live.
// ---------------------------------------------------------------------------

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Request-originated base for the reset link (http action passes `origin`);
// falls back to the configured frontend origin.
function resetLinkOrigin(): string {
  return process.env.FRONTEND_URL ?? process.env.SITE_URL ?? "http://localhost:5173";
}

function exposeResetLink(): boolean {
  // Like the Express config (`NODE_ENV !== "production"`), dev builds expose
  // the link. Production deployments must opt in via RESET_LINK_DEBUG=true
  // until an email provider replaces this.
  return process.env.NODE_ENV !== "production" || process.env.RESET_LINK_DEBUG === "true";
}

function randomResetToken(): string {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "rst-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
  }
}

async function deleteTokensForEmail(ctx: any, email: string) {
  const rows = await ctx.db.query("resetTokens").withIndex("by_email", (q: any) => q.eq("email", email)).collect();
  for (const row of rows) await ctx.db.delete(row._id);
}

// Forgot password: issue a one-time reset token (60 min). Responds with the
// same message whether or not the account exists (no account enumeration).
export const forgotPassword = mutation({
  args: { email: v.string(), origin: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    });
    if (!user) {
      return { message: "If an account exists for that email, a reset link has been sent." };
    }
    // Invalidate any previous outstanding/expired token for this address so a
    // single token is valid at any time.
    await deleteTokensForEmail(ctx, email);
    const token = randomResetToken();
    await ctx.db.insert("resetTokens", {
      email,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
      createdAt: new Date().toISOString(),
    });
    // The link is returned to the HTTP layer (never to clients unless dev) so
    // it can be emailed to the user by the caller.
    const origin = args.origin ?? resetLinkOrigin();
    const resetLink = `${origin.replace(/\/+$/, "")}/reset-password?token=${token}`;
    console.log("[auth] password reset requested for " + email);
    if (exposeResetLink()) console.log("[auth] RESET LINK: " + resetLink);
    return {
      message: "If an account exists for that email, a reset link has been sent.",
      resetLink,
      ...(exposeResetLink() ? { devResetLink: resetLink } : {}),
    };
  },
});

// Reset password with the one-time token (hash written via the auth component
// adapter, so sign-in verification works unchanged).
export const resetPassword = mutation({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    if (!args.token || !args.newPassword || args.newPassword.length < 8) {
      throw new HttpError(400, "A valid token and a password of at least 8 characters are required.");
    }
    const record = await ctx.db
      .query("resetTokens")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (!record) throw new HttpError(400, "This reset link is invalid or has already been used.");
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await ctx.db.delete(record._id);
      throw new HttpError(400, "This reset link has expired. Please request a new one.");
    }
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: record.email }],
    });
    if (!user) throw new HttpError(400, "Account not found.");
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", value: user.id },
        { field: "providerId", value: "credential" },
      ],
    });
    if (!account) throw new HttpError(400, "No password account found for this user.");
    const password = await hashPassword(args.newPassword);
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: { model: "account", update: { password }, where: [{ field: "_id", value: account._id }] },
    });
    // The password changed: no other outstanding link may remain usable.
    await deleteTokensForEmail(ctx, record.email);
    return { message: "Password updated successfully. You can now sign in." };
  },
});

// Social sign-in: a Google user may not have a member profile yet.
// First social sign-in provisions one automatically (same defaults as email sign-up).
async function ensureMemberProfile(ctx: any, user: any) {
  const existing = await ctx.db
    .query("members")
    .withIndex("by_email", (q: any) => q.eq("email", user.email as string))
    .first();
  if (existing) return existing;
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
  const profile = {
    name: (user.name as string) ?? (user.email as string),
    email: user.email as string,
    phone: "+256-700-000000",
    plan: "Saver",
    homeCountry: "Uganda",
    homeCity: "Kampala",
    address: "Kampala, Uganda",
    memberCode,
    joinedAt: new Date().toISOString(),
    hubAddresses,
  };
  await ctx.db.insert("members", profile);
  return profile;
}

function sessionTokenFromCookie(cookie: string | null | undefined): string | null {
  if (!cookie) return null;
  const m = /(?:^|;)\s*better-auth\.session_token=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]) : null;
}

// Exchange a social-login session cookie (set by the Better Auth OAuth
// callback on the API origin) for the { token, user } JSON contract the
// frontends store, provisioning a member profile on first sign-in.
export const socialSession = mutation({
  args: { cookie: v.union(v.null(), v.string()) },
  handler: async (ctx, args) => {
    const token = sessionTokenFromCookie(args.cookie);
    if (!token) throw new HttpError(401, "No active session. Please sign in again.");
    const auth = createAuth(ctx);
    let session: any = null;
    try {
      session = await auth.api.getSession({
        headers: {
          authorization: "Bearer " + token,
          cookie: "better-auth.session_token=" + token,
        },
      });
    } catch (err: any) {
      throw new HttpError(401, "Your session is invalid or expired. Please sign in again.");
    }
    const user = session?.user;
    if (!user) throw new HttpError(401, "Your session is invalid or expired. Please sign in again.");
    const isAdmin = await adminRole(ctx, user.email as string);
    const base: any = toPublicUser(user, isAdmin);
    if (!isAdmin) {
      const profile = await ensureMemberProfile(ctx, user);
      base.memberCode = profile.memberCode;
      base.plan = profile.plan;
      base.homeCountry = profile.homeCountry;
      base.homeCity = profile.homeCity;
      base.hubAddresses = profile.hubAddresses;
    }
    return { message: "Logged in successfully", token, user: base };
  },
});
