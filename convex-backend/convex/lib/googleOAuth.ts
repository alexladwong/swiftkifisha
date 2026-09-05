// Google OAuth helpers for Convex HTTP actions.
//
// Better Auth 1.6 registers /api/auth/sign-in/social as POST-only and mounts
// its callback handling inside the component, so the anchor-GET flow the
// frontends use is bridged here with an equivalent state + code exchange:
//   GET /api/auth/sign-in/social  → 302 to Google (state = HMAC(callbackURL))
//   GET /api/auth/callback/google → code exchange, creates the Better Auth
//     user + session rows, sets the session cookie, redirects to callbackURL
// (implemented in convex/http.ts). fetch/WebCrypto are available in HTTP
// actions; mutations must not call these helpers.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleCredentials() {
  const clientId = process.env.BETTER_AUTH_GOOGLE_ID || "";
  const clientSecret = process.env.BETTER_AUTH_GOOGLE_SECRET || "";
  return { clientId, clientSecret, enabled: Boolean(clientId && clientSecret) };
}

export function googleAuthURL(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return GOOGLE_AUTH_URL + "?" + params.toString();
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "";
  }
  return out;
}

function base64UrlToBytes(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const val = B64.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** state = base64url(payload).hex(hmac) — callbackURL travels inside. */
export async function signGoogleState(secret: string, callbackURL: string): Promise<string> {
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ cb: callbackURL, exp: Date.now() + 10 * 60 * 1000 })),
  );
  const sig = await hmacHex(secret, payload);
  return payload + "." + sig;
}

export async function readGoogleState(secret: string, state: string): Promise<string | null> {
  try {
    const dot = state.indexOf(".");
    if (dot <= 0) return null;
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = await hmacHex(secret, payload);
    if (sig.length !== expected.length) return null;
    // constant-time compare
    let diff = 0;
    for (let i = 0; i < expected.length; i++) if (sig.charCodeAt(i) !== expected.charCodeAt(i)) diff++;
    if (diff !== 0) return null;
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { cb?: string; exp?: number };
    if (typeof data.cb !== "string" || !/^https?:\/\//.test(data.cb)) return null;
    if (!data.exp || data.exp < Date.now()) return null;
    return data.cb;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode({
  code,
  redirectUri,
  clientId,
  clientSecret,
}: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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
  const meRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: "Bearer " + tokens.access_token },
  });
  if (!meRes.ok) throw new Error("Could not load your Google profile.");
  return (await meRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
}

export function randomSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
