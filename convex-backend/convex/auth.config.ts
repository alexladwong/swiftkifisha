import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

// Registers Better Auth as SwiftPak's Convex authentication provider, so
// Convex-native auth (ctx.auth) also understands Better Auth sessions.
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
