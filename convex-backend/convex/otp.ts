import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { HttpError } from "./lib/authz";
import { randomSessionToken } from "./lib/googleOAuth";
import { sendOtpEmail } from "./lib/mailer";

// Admin passwordless sign-in (email + 6-digit OTP) — same contract as the
// Express API (POST /api/auth/admin/otp/request + /verify).

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MIN_RESEND_MS = 20 * 1000;

/** Matches authbridge.exposeResetLink: dev/dev-demo secrets gate. */
function exposeDevSecrets(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.RESET_LINK_DEBUG === "true";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function findAdminUser(ctx: any, email: string) {
  const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email }],
  });
  if (!user) return null;
  const admin = await ctx.db
    .query("admins")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .first();
  return admin ? user : null;
}

async function findOtp(ctx: any, email: string) {
  return ctx.db.query("adminOtps").withIndex("by_email", (q: any) => q.eq("email", email)).first();
}

/** POST /api/auth/admin/otp/request { email } — emails a one-time code. */
export const adminOtpRequest = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    try {
      const email = args.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, "A valid email address is required.");
      }
      const admin = await findAdminUser(ctx, email);
      const existing = await findOtp(ctx, email);
      if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < OTP_MIN_RESEND_MS) {
        throw new HttpError(429, "Please wait a moment before requesting another code.");
      }
      if (admin) {
        const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
        if (existing) await ctx.db.delete(existing._id);
        await ctx.db.insert("adminOtps", {
          email,
          codeHash: await sha256Hex(code),
          expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
          createdAt: new Date().toISOString(),
          lastSentAt: new Date().toISOString(),
          attempts: 0,
        });
        if (exposeDevSecrets()) console.log("[otp] admin sign-in code for " + email + ": " + code);
        sendOtpEmail({ to: email, code }).catch((e) =>
          console.error("[mail] OTP email to " + email + " failed:", (e as Error)?.message ?? e));
        return {
          message: "If that email belongs to an admin, a sign-in code is on its way.",
          ...(exposeDevSecrets() ? { devOtp: code } : {}),
        };
      }
      return { message: "If that email belongs to an admin, a sign-in code is on its way." };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, "[otp.request] " + String((err as Error)?.stack ?? err));
    }
  },
});

/**
 * POST /api/auth/admin/otp/verify { email, code } — validates the code and
 * signs the admin in: creates a Better Auth session row and returns the same
 * { token, user } contract as the dashboard login (auto-login).
 */
export const adminOtpVerify = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    try {
      const email = args.email.trim().toLowerCase();
      const code = String(args.code || "").trim();
      const record = await findOtp(ctx, email);
      if (!record) throw new HttpError(400, "Invalid or expired code. Request a new one.");
      if (new Date(record.expiresAt).getTime() < Date.now()) {
        await ctx.db.delete(record._id);
        throw new HttpError(400, "This code has expired. Request a new one.");
      }
      if (record.attempts >= OTP_MAX_ATTEMPTS) {
        await ctx.db.delete(record._id);
        throw new HttpError(429, "Too many attempts. Request a new code.");
      }
      if (!code || (await sha256Hex(code)) !== record.codeHash) {
        await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
        throw new HttpError(400, "Invalid code. Please try again.");
      }
      const admin = await findAdminUser(ctx, email);
      if (!admin) throw new HttpError(400, "Invalid or expired code. Request a new one.");
      await ctx.db.delete(record._id);

      const token = randomSessionToken();
      const now = Date.now();
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "session",
          data: {
            userId: admin.id ?? admin._id,
            token,
            expiresAt: now + 30 * 24 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          },
        },
      });
      const user = {
        _id: admin.id, id: admin.id, name: admin.name, email: admin.email,
        role: "admin", createdAt: admin.createdAt ?? new Date().toISOString(),
      };
      return { message: "Logged in successfully", token, user };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, "[otp.verify] " + String((err as Error)?.stack ?? err));
    }
  },
});

/** One-off admin provisioning (Better Auth user + admins row), idempotent. */
export const addAdminAccount = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existingRow = await ctx.db
      .query("admins")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();
    const existingUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    });
    if (!existingUser) {
      const now = Date.now();
      const created = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "user",
          data: {
            name: args.name.trim().slice(0, 80),
            email,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      });
      if (!created) throw new HttpError(500, "Failed to create the user record.");
    }
    if (!existingRow) {
      await ctx.db.insert("admins", { email, name: args.name.trim(), createdAt: new Date().toISOString() });
    }
    return { message: "Admin account ready." };
  },
});
