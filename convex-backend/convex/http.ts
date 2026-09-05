import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { authComponent, createAuth } from "./betterAuth/auth";
import { HttpError, bearerTokenOf } from "./lib/authz";

const http = httpRouter();

// Better Auth endpoints live under /api/auth/* (sign-in/email, get-session, ...).
authComponent.registerRoutes(http, createAuth, { cors: true });

/* ------------------------- response helpers ------------------------- */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

function statusFromError(e: unknown): number {
  if (e instanceof HttpError) return e.status;
  const message = (e as Error)?.message ?? "";
  if (/Authentication required/.test(message)) return 401;
  if (/Invalid email or password/.test(message)) return 401;
  if (/Admin access/.test(message)) return 403;
  if (/already exists/.test(message)) return 409;
  if (/not found|already exists|required|must be|invalid/i.test(message)) return 400;
  return 500;
}

function messageFromError(e: unknown): string {
  if (e instanceof HttpError) return e.message;
  const raw = (e as Error)?.message ?? "Internal server error.";
  const m = /^\[(\w+)\]:?\s*(.*)$/.exec(raw);
  if (m) return m[2] || "Internal server error.";
  return raw || "Internal server error.";
}

function err(e: unknown) {
  console.error("[http]", (e as Error)?.message ?? e);
  return json(statusFromError(e), { message: messageFromError(e) });
}

function tokenOf(req: Request): string | null {
  return bearerTokenOf(req.headers.get("authorization"));
}

async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    return (await req.json()) ?? {};
  } catch {
    return {};
  }
}

function num(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

/* --------------------------- public routes --------------------------- */

http.route({
  path: "/api/health", method: "GET",
  handler: httpAction(async () => json(200, { status: "ok", service: "swiftship-api-convex", cloud: "https://precise-pig-300.convex.cloud", site: "https://precise-pig-300.convex.site" })),
});

http.route({ path: "/", method: "GET", handler: httpAction(async () => json(200, {
  message: "SwiftKifisha Global API on Convex (precise-pig-300).",
  health: "/api/health", endpoints: "see convex-backend/README.md",
})) });

// Custom dashboard login bridge (same JSON contract as the local API).
http.route({
  path: "/api/auth/login", method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.authbridge.login, { email: String(body.email ?? ""), password: String(body.password ?? "") });
      return json(200, result);
    } catch (e) { return err(e); }
  }),
});

// Public member sign-up bridge (same JSON contract as the local API).
http.route({
  path: "/api/auth/signup", method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.authbridge.signUp, { name: String(body.name ?? ""), email: String(body.email ?? ""), password: String(body.password ?? "") });
      return json(201, result);
    } catch (e) { return err(e); }
  }),
});

// Shadow-safe aliases (see README "Notes / known constraints").
http.route({ path: "/api/login", method: "POST", handler: httpAction(async (ctx, req) => {
  try {
    const body = await readJson(req);
    const result = await ctx.runMutation(api.authbridge.login, { email: String(body.email ?? ""), password: String(body.password ?? "") });
    return json(200, result);
  } catch (e) { return err(e); }
}) });
http.route({ path: "/api/signup", method: "POST", handler: httpAction(async (ctx, req) => {
  try {
    const body = await readJson(req);
    const result = await ctx.runMutation(api.authbridge.signUp, { name: String(body.name ?? ""), email: String(body.email ?? ""), password: String(body.password ?? "") });
    return json(201, result);
  } catch (e) { return err(e); }
}) });

http.route({ path: "/api/add-user", method: "POST", handler: httpAction(async (ctx, req) => {
  try {
    const body = await readJson(req);
    const result = await ctx.runMutation(api.authbridge.addUser, { token: tokenOf(req), name: String(body.name ?? ""), email: String(body.email ?? ""), password: String(body.password ?? "") });
    return json(201, result);
  } catch (e) { return err(e); }
}) });

// Custom add-admin bridge (same JSON contract as the local API).
http.route({
  path: "/api/auth/add-user", method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.authbridge.addUser, {
        token: tokenOf(req),
        name: String(body.name ?? ""), email: String(body.email ?? ""), password: String(body.password ?? ""),
      });
      return json(201, result);
    } catch (e) { return err(e); }
  }),
});

http.route({ path: "/api/shop/hubs", method: "GET", handler: httpAction(async (ctx) => {
  try { return json(200, await ctx.runQuery(api.shop.hubs)); } catch (e) { return err(e); }
}) });
http.route({ path: "/api/shop/world", method: "GET", handler: httpAction(async (ctx) => {
  try { return json(200, await ctx.runQuery(api.shop.world)); } catch (e) { return err(e); }
}) });

/* --------------------------- parcels routes --------------------------- */

// GET /api/parcels — admin list
http.route({ path: "/api/parcels", method: "GET", handler: httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const result = await ctx.runMutation(api.parcels.list, {
      token: tokenOf(req),
      page: num(url.searchParams.get("page"), 1),
      limit: num(url.searchParams.get("limit"), 10),
      search: url.searchParams.get("search") ?? "",
      member: url.searchParams.get("member") ?? "",
      originCountry: url.searchParams.get("originCountry") ?? "",
      destinationCountry: url.searchParams.get("destinationCountry") ?? "",
    });
    return json(200, result);
  } catch (e) { return err(e); }
}) });

// POST /api/parcels — admin create
http.route({ path: "/api/parcels", method: "POST", handler: httpAction(async (ctx, req) => {
  try {
    const body = await readJson(req);
    const result = await ctx.runMutation(api.parcels.create, { token: tokenOf(req), parcel: body });
    return json(201, result);
  } catch (e) { return err(e); }
}) });

// POST /api/parcels/calculate-cost — public estimator
http.route({ path: "/api/parcels/calculate-cost", method: "POST", handler: httpAction(async (ctx, req) => {
  try {
    const body = await readJson(req);
    const result = await ctx.runQuery(api.parcels.quote, {
      shipmentType: body.shipmentType,
      originCity: body.originCity, destinationCity: body.destinationCity,
      originCountry: body.originCountry, destinationCountry: body.destinationCountry,
      parcelCategory: body.parcelCategory,
      weight: Number(body.weight) || undefined,
      deliveryType: body.deliveryType,
    });
    return json(200, result);
  } catch (e) { return err(e); }
}) });

// Everything else under /api/parcels/: track/{trackingId} and {id}/checkpoint.
http.route({ pathPrefix: "/api/parcels/", method: "GET", handler: httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const rest = url.pathname.slice("/api/parcels/".length);
    if (rest.startsWith("track/")) {
      const trackingId = decodeURIComponent(rest.slice("track/".length));
      const doc = await ctx.runQuery(api.parcels.track, { trackingId });
      if (!doc) return json(404, { message: "No parcel found with tracking ID " + trackingId + "." });
      return json(200, doc);
    }
    return json(404, { message: "Route not found." });
  } catch (e) { return err(e); }
}) });

http.route({ pathPrefix: "/api/parcels/", method: "POST", handler: httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const rest = url.pathname.slice("/api/parcels/".length);
    const m = /^([^/]+)\/checkpoint$/.exec(rest);
    if (m) {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.parcels.addCheckpoint, { token: tokenOf(req), id: decodeURIComponent(m[1]), checkpoint: body });
      return json(200, result);
    }
    return json(404, { message: "Route not found." });
  } catch (e) { return err(e); }
}) });

/* --------------------------- dashboard routes --------------------------- */

http.route({ path: "/api/dashboard/stats", method: "GET", handler: httpAction(async (ctx, req) => {
  try { return json(200, await ctx.runMutation(api.stats.dashboard, { token: tokenOf(req) })); } catch (e) { return err(e); }
}) });

/* --------------------------- analytics routes --------------------------- */

http.route({ path: "/api/analytics/summary", method: "GET", handler: httpAction(async (ctx, req) => {
  try { return json(200, await ctx.runMutation(api.analytics.summary, { token: tokenOf(req) })); } catch (e) { return err(e); }
}) });
http.route({ path: "/api/analytics/revenue", method: "GET", handler: httpAction(async (ctx, req) => {
  try { return json(200, await ctx.runMutation(api.analytics.revenue, { token: tokenOf(req) })); } catch (e) { return err(e); }
}) });
http.route({ path: "/api/analytics/parcels", method: "GET", handler: httpAction(async (ctx, req) => {
  try { return json(200, await ctx.runMutation(api.analytics.growth, { token: tokenOf(req) })); } catch (e) { return err(e); }
}) });
http.route({ path: "/api/analytics/top-cities", method: "GET", handler: httpAction(async (ctx, req) => {
  try { return json(200, await ctx.runMutation(api.analytics.topCities, { token: tokenOf(req) })); } catch (e) { return err(e); }
}) });
http.route({ path: "/api/analytics/delivery-performance", method: "GET", handler: httpAction(async (ctx, req) => {
  try { return json(200, await ctx.runMutation(api.analytics.deliveryPerformance, { token: tokenOf(req) })); } catch (e) { return err(e); }
}) });

/* ----------------------------- members routes ----------------------------- */

http.route({ path: "/api/members", method: "GET", handler: httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const result = await ctx.runMutation(api.members.list, { token: tokenOf(req), page: num(url.searchParams.get("page"), 1), limit: num(url.searchParams.get("limit"), 20), search: url.searchParams.get("search") ?? "" });
    return json(200, result);
  } catch (e) { return err(e); }
}) });

http.route({ pathPrefix: "/api/members/", method: "GET", handler: httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const rest = decodeURIComponent(url.pathname.slice("/api/members/".length));
    if (rest === "me") {
      const result = await ctx.runMutation(api.members.me, { token: tokenOf(req) });
      return json(200, result);
    }
    if (rest === "me/parcels") {
      const result = await ctx.runMutation(api.members.myParcels, { token: tokenOf(req), limit: num(url.searchParams.get("limit"), 10) });
      return json(200, result);
    }
    const result = await ctx.runMutation(api.members.detail, { token: tokenOf(req), id: rest });
    if (!result) return json(404, { message: "Member not found." });
    return json(200, result);
  } catch (e) { return err(e); }
}) });

http.route({
  path: "/api/members/me", method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.members.updateMe, {
        token: tokenOf(req),
        name: body.name !== undefined ? String(body.name) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        homeCity: body.homeCity !== undefined ? String(body.homeCity) : undefined,
        homeCountry: body.homeCountry !== undefined ? String(body.homeCountry) : undefined,
      });
      return json(200, result);
    } catch (e) { return err(e); }
  }),
});

http.route({
  path: "/api/auth/change-password", method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.authbridge.changePassword, {
        token: tokenOf(req),
        currentPassword: String(body.currentPassword ?? ""),
        newPassword: String(body.newPassword ?? ""),
      });
      return json(200, result);
    } catch (e) { return err(e); }
  }),
});

http.route({
  path: "/api/change-password", method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await readJson(req);
      const result = await ctx.runMutation(api.authbridge.changePassword, {
        token: tokenOf(req),
        currentPassword: String(body.currentPassword ?? ""),
        newPassword: String(body.newPassword ?? ""),
      });
      return json(200, result);
    } catch (e) { return err(e); }
  }),
});

// Preflight for custom routes.
http.route({ pathPrefix: "/api/", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

export default http;