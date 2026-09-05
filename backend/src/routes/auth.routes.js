import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES } from "../lib/intl.js";
import { sendPasswordResetEmail, sendOtpEmail } from "../lib/mailer.js";
import {
  googleConfig, googleStateToken, readGoogleState, googleAuthURL, exchangeGoogleCode,
} from "../lib/google.js";

const router = Router();
const publicUser = ({ _id, name, email, role, createdAt }) => ({ _id, name, email, role, createdAt });

/** Attach the member profile (plan, mailboxes, home) to a signed-in member user. */
function withMemberProfile(user) {
  const profile = db.data.members.find((m) => m.email === user.email);
  if (!profile) return publicUser(user);
  return {
    _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt,
    memberCode: profile.memberCode, plan: profile.plan,
    homeCountry: profile.homeCountry, homeCity: profile.homeCity,
    hubAddresses: profile.hubAddresses,
  };
}

/** POST /api/auth/login  { email, password } -> { token, user } */
router.post("/login", ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  const user = db.data.users.find((u) => u.email === String(email).toLowerCase().trim());
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  const token = jwt.sign(
    { sub: user._id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
  return res.json({ message: "Logged in successfully", token, user: withMemberProfile(user) });
}));

/** POST /api/auth/add-user  { name, email, password } (admin only) */
router.post("/add-user", requireAuth, ah(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Name is required." });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ message: "A valid email address is required." });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }
  const normalized = String(email).toLowerCase().trim();
  if (db.data.users.some((u) => u.email === normalized)) {
    return res.status(409).json({ message: "An admin with this email already exists." });
  }
  const user = {
    _id: objectId(),
    name: String(name).trim(),
    email: normalized,
    passwordHash: await bcrypt.hash(String(password), config.bcryptRounds ?? 10),
    role: "admin",
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  db.persist();
  return res.status(201).json({ message: "Admin created successfully", user: publicUser(user) });
}));

/** POST /api/auth/signup  { name, email, password } -> member account + mailboxes */
router.post("/signup", ah(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ message: "Name is required." });
  if (!isEmail(email)) return res.status(400).json({ message: "A valid email address is required." });
  if (!password || String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
  const normalized = String(email).toLowerCase().trim();
  if (db.data.users.some((u) => u.email === normalized)) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }
  const user = {
    _id: objectId(),
    name: String(name).trim(),
    email: normalized,
    passwordHash: await bcrypt.hash(String(password), config.bcryptRounds ?? 10),
    role: "member",
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);

  // Member profile: Saver plan, Uganda home, US + UK mailboxes with unique suite.
  const memberCode = "SP-" + String(10000 + db.data.members.length + Math.floor(Math.random() * 80000));
  const hubAddresses = ["United States", "United Kingdom"].map((country) => {
    const hub = HUB_COUNTRIES.find((h) => h.country === country);
    return {
      country,
      city: hub ? hub.city : country,
      suite: memberCode + "-" + (hub ? hub.code : "XX"),
      addressLines: HUB_MAILBOX_EXAMPLES[country] ?? [],
    };
  });
  const member = {
    _id: objectId(),
    name: user.name,
    email: normalized,
    phone: "+256-700-000000",
    plan: "Saver",
    homeCountry: "Uganda",
    homeCity: "Kampala",
    address: "Kampala, Uganda",
    memberCode,
    joinedAt: new Date().toISOString(),
    hubAddresses,
  };
  db.data.members.push(member);
  db.persist();

  const token = jwt.sign(
    { sub: user._id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
  return res.status(201).json({
    message: "Account created successfully",
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: "member", createdAt: user.createdAt,
      memberCode, plan: member.plan, homeCountry: member.homeCountry, homeCity: member.homeCity, hubAddresses },
  });
}));

/* --------------------- Admin email-OTP sign-in (no password) --------------------- */

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_MIN_RESEND_MS = 20 * 1000;

function adminByEmail(email) {
  return db.data.users.find((u) => u.email === email && u.role === "admin") || null;
}

function otpRecordFor(email) {
  const rows = db.data.adminOtps || [];
  return rows.find((r) => r.email === email) || null;
}

function saveOtp(record) {
  if (!db.data.adminOtps) db.data.adminOtps = [];
  db.data.adminOtps = db.data.adminOtps.filter((r) => r.email !== record.email);
  db.data.adminOtps.push(record);
  db.persist();
}

/**
 * POST /api/auth/admin/otp/request { email }
 * Emails a 6-digit one-time code to the admin address (no password needed).
 * Responds identically whether or not the address belongs to an admin; in dev
 * the code is also returned as `devOtp` (and always written to the log).
 */
router.post("/admin/otp/request", ah(async (req, res) => {
  const email = String((req.body || {}).email || "").toLowerCase().trim();
  if (!isEmail(email)) {
    return res.status(400).json({ message: "A valid email address is required." });
  }
  const admin = adminByEmail(email);
  const existing = otpRecordFor(email);
  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < OTP_MIN_RESEND_MS) {
    return res.status(429).json({ message: "Please wait a moment before requesting another code." });
  }
  if (admin) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    saveOtp({
      email,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      lastSentAt: new Date().toISOString(),
    });
    if (config.isDev) console.log(`[otp] admin sign-in code for ${email}: ${code}`);
    sendOtpEmail({ to: email, code }).catch((e) =>
      console.error(`[mail] OTP email to ${email} failed:`, e?.message ?? e));
    return res.json({
      message: "If that email belongs to an admin, a sign-in code is on its way.",
      ...(config.isDev ? { devOtp: code } : {}),
    });
  }
  return res.json({ message: "If that email belongs to an admin, a sign-in code is on its way." });
}));

/**
 * POST /api/auth/admin/otp/verify { email, code }
 * Validates the code and signs the admin in (auto-login, same JWT contract as
 * the password login so the dashboard just stores { token, user }).
 */
router.post("/admin/otp/verify", ah(async (req, res) => {
  const email = String((req.body || {}).email || "").toLowerCase().trim();
  const code = String((req.body || {}).code || "").trim();
  const record = otpRecordFor(email);
  if (!record) {
    return res.status(400).json({ message: "Invalid or expired code. Request a new one." });
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    db.data.adminOtps = db.data.adminOtps.filter((r) => r.email !== email);
    db.persist();
    return res.status(400).json({ message: "This code has expired. Request a new one." });
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    db.data.adminOtps = db.data.adminOtps.filter((r) => r.email !== email);
    db.persist();
    return res.status(429).json({ message: "Too many attempts. Request a new code." });
  }
  if (!code || sha256(code) !== record.codeHash) {
    record.attempts += 1;
    saveOtp(record);
    return res.status(400).json({ message: "Invalid code. Please try again." });
  }
  const admin = adminByEmail(email);
  if (!admin) {
    return res.status(400).json({ message: "Invalid or expired code. Request a new one." });
  }
  db.data.adminOtps = db.data.adminOtps.filter((r) => r.email !== email);
  db.persist();
  const token = jwt.sign(
    { sub: admin._id, role: admin.role, name: admin.name, email: admin.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
  return res.json({ message: "Logged in successfully", token, user: publicUser(admin) });
}));

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * GET /api/auth/social/providers
 * Contract parity with the Convex backend. Google appears when its OAuth
 * credentials are configured in the env (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).
 */
router.get("/social/providers", (req, res) => {
  const providers = [];
  if (googleConfig().enabled) providers.push("google");
  res.json({ providers });
});

/* ------------------------- Google social sign-in ------------------------- */

function cookieValue(req, name) {
  const header = req.headers.cookie || "";
  const m = new RegExp(`(?:^|;)\\s*${name}=([^;]+)`).exec(header);
  return m ? decodeURIComponent(m[1]) : null;
}

const SK_SESSION_COOKIE = "sk_session";

function setSessionCookie(res, token) {
  res.cookie(SK_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !config.isDev,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

/**
 * GET /api/auth/sign-in/social?provider=google&callbackURL=<app origin path>
 * Starts the OAuth dance. The redirect URI registered in the Google console is
 * <callbackURL origin>/api/auth/callback/google (proxied to this API in dev).
 */
router.get("/sign-in/social", ah(async (req, res) => {
  const provider = String(req.query.provider || "");
  const callbackURL = String(req.query.callbackURL || "");
  if (provider !== "google") {
    return res.status(400).json({ message: "Unsupported social provider." });
  }
  const g = googleConfig();
  if (!g.enabled) {
    return res.status(503).json({ message: "Google sign-in is not configured on this backend." });
  }
  let origin;
  try {
    origin = new URL(callbackURL).origin;
    if (origin === "null") throw new Error("bad");
  } catch {
    return res.status(400).json({ message: "A valid callback URL is required." });
  }
  const redirectURI = origin + "/api/auth/callback/google";
  const state = googleStateToken(callbackURL);
  return res.redirect(googleAuthURL({ clientId: g.clientId, redirectURI, state }));
}));

/**
 * GET /api/auth/callback/google?code=&state=
 * Google redirect target. Exchanges the code, finds-or-creates the user
 * (existing admins keep their role; new users become members with a mailbox
 * profile), sets the session cookie and returns the browser to callbackURL.
 */
router.get("/callback/google", ah(async (req, res) => {
  const fail = (message) => {
    const cb = readGoogleState(String(req.query.state || "")) || "/";
    const sep = cb.includes("?") ? "&" : "?";
    return res.redirect(cb + sep + "error=" + encodeURIComponent(message));
  };
  const code = String(req.query.code || "");
  if (!code) return fail("Google did not return an authorization code.");

  const callbackURL = readGoogleState(String(req.query.state || ""));
  let origin;
  try {
    origin = new URL(callbackURL || "/").origin;
    if (origin === "null") throw new Error("bad");
  } catch {
    return res.status(400).json({ message: "Invalid sign-in state. Please try again." });
  }
  const g = googleConfig();
  const redirectURI = origin + "/api/auth/callback/google";

  let profile;
  try {
    profile = await exchangeGoogleCode({
      code,
      redirectURI,
      clientId: g.clientId,
      clientSecret: g.clientSecret,
    });
  } catch (err) {
    console.error("[google] callback failed:", err?.message ?? err);
    return fail("Google sign-in failed. Please try again.");
  }
  const email = String(profile.email || "").toLowerCase().trim();
  if (!email || profile.email_verified === false) {
    return fail("Google sign-in requires an account with a verified email address.");
  }

  let user = db.data.users.find((u) => u.email === email);
  let createdMember = false;
  if (!user) {
    // New Google users become members with the same defaults as email sign-up.
    const name = String(profile.name || email.split("@")[0] || "Member").slice(0, 80);
    user = {
      _id: objectId(),
      name,
      email,
      passwordHash: null,
      role: "member",
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);

    const memberCode = "SP-" + String(10000 + db.data.members.length + Math.floor(Math.random() * 80000));
    const hubAddresses = ["United States", "United Kingdom"].map((country) => {
      const hub = HUB_COUNTRIES.find((h) => h.country === country);
      return {
        country,
        city: hub ? hub.city : country,
        suite: memberCode + "-" + (hub ? hub.code : "XX"),
        addressLines: HUB_MAILBOX_EXAMPLES[country] ?? [],
      };
    });
    db.data.members.push({
      _id: objectId(),
      name,
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
    createdMember = true;
  } else if (user.role === "admin" && !db.data.users.find((u) => u.email === email && u.passwordHash)) {
    // nothing to change — admins simply sign in
  }
  if (createdMember) db.persist();

  const token = jwt.sign(
    { sub: user._id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
  setSessionCookie(res, token);
  return res.redirect(callbackURL || "/");
}));

/**
 * GET /api/auth/social/session
 * Exchanges the sk_session cookie set after the OAuth callback for the same
 * { token, user } contract as the email login (called by the frontend's
 * /auth/callback page with credentials).
 */
router.get("/social/session", ah(async (req, res) => {
  const token = cookieValue(req, SK_SESSION_COOKIE);
  if (!token) return res.status(401).json({ message: "No active session. Please sign in again." });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Your session is invalid or expired. Please sign in again." });
  }
  const user = db.data.users.find((u) => u._id === payload.sub);
  if (!user) return res.status(401).json({ message: "Your session is invalid or expired. Please sign in again." });
  return res.json({ message: "Logged in successfully", token, user: withMemberProfile(user) });
}));

/** POST /api/auth/forgot-password { email } */
router.post("/forgot-password", ah(async (req, res) => {
  const email = String((req.body || {}).email || "").toLowerCase().trim();
  const user = email ? db.data.users.find((u) => u.email === email) : null;
  if (user) {
    db.data.resetTokens = db.data.resetTokens.filter((rt) => rt.email !== email);
    const token = crypto.randomBytes(32).toString("hex");
    db.data.resetTokens.push({
      _id: objectId(),
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    });
    db.persist();
    const link = `${config.frontendUrl}/reset-password?token=${token}`;
    console.log(`[auth] password reset requested for ${email}`);
    if (config.isDev) console.log(`[auth] DEV RESET LINK: ${link}`);
    sendPasswordResetEmail({ to: email, resetLink: link }).catch((e) => {
      console.error(`[mail] reset email to ${email} failed:`, e?.message ?? e);
    });
    return res.json({
      message: "If an account exists for that email, a reset link has been sent.",
      ...(config.isDev ? { devResetLink: link } : {}),
    });
  }
  return res.json({ message: "If an account exists for that email, a reset link has been sent." });
}));

/** POST /api/auth/reset-password { token, newPassword } */
router.post("/reset-password", ah(async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ message: "A valid token and a password of at least 8 characters are required." });
  }
  const tokenHash = sha256(String(token));
  const record = db.data.resetTokens.find((rt) => rt.tokenHash === tokenHash);
  if (!record) return res.status(400).json({ message: "This reset link is invalid or has already been used." });
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    db.data.resetTokens = db.data.resetTokens.filter((rt) => rt._id !== record._id);
    db.persist();
    return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
  }
  const user = db.data.users.find((u) => u.email === record.email);
  if (!user) return res.status(400).json({ message: "Account not found." });
  user.passwordHash = await bcrypt.hash(String(newPassword), config.bcryptRounds ?? 10);
  db.data.resetTokens = db.data.resetTokens.filter((rt) => rt._id !== record._id);
  db.persist();
  return res.json({ message: "Password updated successfully. You can now sign in." });
}));


/** POST /api/auth/change-password (signed-in user) */
router.post("/change-password", requireAuth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  if (!user.passwordHash) {
    return res.status(400).json({
      message: "This admin has no password set — sign in with your email code instead.",
    });
  }
  if (!currentPassword || !(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters." });
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), config.bcryptRounds ?? 10);
  db.persist();
  return res.json({ message: "Password changed successfully" });
}));

export default router;