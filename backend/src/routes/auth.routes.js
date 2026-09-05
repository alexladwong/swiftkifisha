import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES } from "../lib/intl.js";

const router = Router();
const publicUser = ({ _id, name, email, role, createdAt }) => ({ _id, name, email, role, createdAt });

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

export default router;