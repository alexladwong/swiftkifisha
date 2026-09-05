import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../lib/db.js";

/** Wraps an async route handler so rejections reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Protects admin endpoints: requires a valid `Authorization: Bearer <jwt>`. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ message: "Authentication required. Please log in." });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.data.users.find((u) => u._id === payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists. Please log in again." });
    }
    req.user = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token. Please log in again." });
  }
}
