import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES } from "../lib/intl.js";

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

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const RESET_TTL_MS = 60 * 60 * 1000;

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