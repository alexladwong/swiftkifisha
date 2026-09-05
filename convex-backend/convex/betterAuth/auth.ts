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

// Better Auth options for SwiftUg Global (email + password, sessions stored
// in the component's tables, Convex native auth integration enabled).
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:5174";
  const convexSiteUrl = process.env.CONVEX_SITE_URL ?? "http://localhost:8080";
  return {
    appName: "SwiftUg Global",
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
    },
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