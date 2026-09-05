import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";

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
  return res.json({ message: "Logged in successfully", token, user: publicUser(user) });
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

export default router;
