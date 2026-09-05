// Admin gate: validates the bearer session token issued by Better Auth.
import { createAuth } from "../betterAuth/auth";

type DbCtx = { db: any };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    // The status is embedded in the message because Convex serializes errors
    // across ctx.runMutation boundaries (instanceof is lost); http.ts parses
    // the "[status] " prefix and strips it from the response body.
    super(`[${status}] ${message}`);
  }
}

export function bearerTokenOf(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

/** Resolves the Better Auth user for a session token, or null. */
export async function sessionUser(ctx: DbCtx, token: string | null) {
  if (!token) return null;
  try {
    const auth = createAuth(ctx as any);
    const session = await auth.api.getSession({
      headers: {
        authorization: "Bearer " + token,
        cookie: "better-auth.session_token=" + token,
      },
    });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/** Throws 401 unless the caller is a signed-in user listed in admins. */
export async function requireAdmin(ctx: DbCtx, token: string | null) {
  const user = await sessionUser(ctx, token);
  if (!user) throw new HttpError(401, "Authentication required. Please log in.");
  const admin = await ctx.db.query("admins").withIndex("by_email", (q: any) => q.eq("email", user.email as string)).first();
  if (!admin) throw new HttpError(403, "Admin access required.");
  return { ...user, role: "admin" as const };
}
/** Returns the session user plus their members row (token-bound). */
export async function requireMember(ctx: DbCtx, token: string | null) {
  const user = await sessionUser(ctx, token);
  if (!user) throw new HttpError(401, "Authentication required. Please log in.");
  const member = await ctx.db.query("members").withIndex("by_email", (q: any) => q.eq("email", user.email as string)).first();
  if (!member) throw new HttpError(403, "Member account required.");
  return { user, member: member as any };
}
