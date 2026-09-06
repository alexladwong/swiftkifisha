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
 * The backend OWNS the OAuth callback: the redirect URI is always
 * <api origin> + /api/auth/callback/google — never derived from the
 * browser's window.location.
 *
 * Origin resolution order:
 *   1. PUBLIC_API_URL (explicit; set on the production host, e.g.
 *      https://api.eazyjobs.info)
 *   2. The request's X-Forwarded-Host / X-Forwarded-Proto (reverse proxies:
 *      Caddy, nginx) — this keeps Google sign-in working on hosts whose env
 *      does not (yet) set PUBLIC_API_URL.
 *   3. The plain Host header (direct access, e.g. localhost dev).
 *
 * Google only honors redirect URIs registered in the OAuth console, so a
 * host-derived URI cannot be abused for redirect attacks.
 */
export function googleRedirectURI(req) {
  let base = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
  if (!base && req) {
    const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() || (req.socket?.encrypted ? "https" : "http");
    const host = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase() || String(req.headers.host || "").toLowerCase();
    if (/^[a-z0-9.-]+(:\d+)?$/.test(host)) base = `${proto}://${host}`;
  }
  if (!base) base = "http://localhost:5001";
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
