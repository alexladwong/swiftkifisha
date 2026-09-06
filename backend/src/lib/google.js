/**
 * Google OAuth sign-in for the Express API.
 *
 * Mirrors the Better Auth social contract the frontends already use:
 *   GET /api/auth/sign-in/social?provider=google&callbackURL=…
 *     → 302 to Google
 *   GET /api/auth/callback/google?code=&state=  (redirect URI registered in
 *     the Google console — the app origin + this path)
 *     → sets the sk_session cookie and 302s back to callbackURL
 *   GET /api/auth/social/session                (cookie)
 *     → { token, user } — the frontend /auth/callback page stores it
 *
 * Credentials: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (see backend/.env(.example)).
 */
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleConfig() {
  const clientId = process.env.AUTH_GOOGLE_ID || "";
  const clientSecret = process.env.AUTH_GOOGLE_SECRET || "";
  return { clientId, clientSecret, enabled: Boolean(clientId && clientSecret) };
}

/**
 * The backend OWNS the OAuth callback. The redirect URI must be one the
 * Google console actually registers. Registered set (client 702921110092-…):
 *   http://localhost:5173/api/auth/callback/google        (member dev, via Vite)
 *   http://localhost:5174/api/auth/callback/google        (dashboard dev)
 *   https://swiftkifisha.vercel.app/api/auth/callback/google
 *   https://api.eazyjobs.info/api/auth/callback/google
 *   https://precise-pig-300.convex.site/api/auth/callback/google
 * Every registered URI is a FRONTEND/API origin whose /api path reaches this
 * Express backend (Vite proxy locally, rewrite/proxy in production), so we
 * emit <frontend origin>/api/auth/callback/google from the signed callbackURL
 * the app itself supplied — seamless offline and online, zero console edits.
 *
 * Origin resolution order:
 *   1. PUBLIC_API_URL (explicit override, e.g. api.eazyjobs.info host).
 *   2. The signed callbackURL origin (frontend app origin) — registered.
 *   3. X-Forwarded-Host / X-Forwarded-Proto (direct reverse proxies).
 *   4. The plain Host header.
 *
 * Safe by construction: callbackURL rides inside our own signed state, and
 * Google only redirects to console-registered URIs anyway.
 */
export function googleRedirectURI(req, callbackURL) {
  let base = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
  if (!base && typeof callbackURL === "string" && /^https?:\/\//.test(callbackURL)) {
    try {
      base = new URL(callbackURL).origin.replace(/\/+$/, "");
    } catch { /* fall through */ }
  }
  if (!base && req) {
    const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() || (req.socket?.encrypted ? "https" : "http");
    const host = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase() || String(req.headers.host || "").toLowerCase();
    if (/^[a-z0-9.-]+(:\d+)?$/.test(host)) base = `${proto}://${host}`;
  }
  if (!base) base = "http://localhost:5173";
  return base.replace(/\/+$/, "") + "/api/auth/callback/google";
}

/** Stateless signed state carrying the frontend callback URL (10 min). */
export function googleStateToken(callbackURL) {
  return jwt.sign({ cb: callbackURL }, config.jwtSecret, { expiresIn: "10m" });
}

export function readGoogleState(state) {
  try {
    const payload = jwt.verify(String(state || ""), config.jwtSecret);
    return typeof payload.cb === "string" && /^https?:\/\//.test(payload.cb) ? payload.cb : null;
  } catch {
    return null;
  }
}

export function googleAuthURL({ clientId, redirectURI, state, prompt = "select_account" }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectURI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchanges the authorization code for the user's Google profile. */
export async function exchangeGoogleCode({ code, redirectURI, clientId, clientSecret }) {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectURI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    let detail = "";
    try {
      detail = (await tokenRes.json()).error_description || "";
    } catch {
      /* ignore */
    }
    throw new Error("Google token exchange failed" + (detail ? ": " + detail : ""));
  }
  const tokens = await tokenRes.json();
  const meRes = await fetch(USERINFO_URL, {
    headers: { Authorization: "Bearer " + tokens.access_token },
  });
  if (!meRes.ok) throw new Error("Could not load your Google profile.");
  return meRes.json();
}
