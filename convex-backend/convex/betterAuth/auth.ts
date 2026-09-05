import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

// Better Auth runs inside a Convex component installed from this folder.
export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
    verbose: false,
  },
);

// Better Auth options for SwiftKifisha Global (email + password, Google
// social sign-in, sessions stored in the component's tables, Convex native
// auth integration enabled).
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:5174";
  const convexSiteUrl = process.env.CONVEX_SITE_URL ?? "http://localhost:8080";
  // OAuth redirect/callback URLs must be reachable by Google, so they point at
  // the Convex site that actually serves /api/auth/* (auto-set in the
  // deployment env) instead of a localhost Vite dev server.
  const baseURL = convexSiteUrl ?? siteUrl;

  // Social providers activate only when their credentials exist in the env.
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  const googleId = process.env.BETTER_AUTH_GOOGLE_ID;
  const googleSecret = process.env.BETTER_AUTH_GOOGLE_SECRET;
  if (googleId && googleSecret) {
    socialProviders.google = { clientId: googleId, clientSecret: googleSecret };
  }
  return {
    appName: "SwiftKifisha Global",
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // NOTE: forgot/reset password is handled by the custom bridge
      // (POST /api/auth/forgot-password + /api/auth/reset-password →
      // authbridge.forgotPassword / authbridge.resetPassword) so it mirrors
      // the Express API contract. Do NOT add `sendResetPassword` here: Better
      // Auth's native request-password-reset flow issues tokens that the
      // bridge endpoints cannot redeem.
    },
    socialProviders,
    // When the frontends call the Convex site directly from another origin
    // (CROSS_SITE_AUTH=true), the session cookie needs SameSite=None over
    // HTTPS. Leave unset when /api is same-origin or proxied.
    ...(process.env.CROSS_SITE_AUTH === "true"
      ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
      : {}),
    trustedOrigins: [
      siteUrl,
      convexSiteUrl,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ],
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

// Used by the auth CLI (npx auth generate --config ./convex/betterAuth/auth.ts ...).
export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));