/**
 * Membership applications — apply, status, and admin review.
 * Mounted at /api/membership (see app.js).
 *
 * Flow: applicant applies (or signs up) → status "pending" → admin reviews →
 *   accept  → member profile + US/UK mailboxes are provisioned, email sent
 *   investigate → status "under_review" (+ optional note)
 *   cancel  → status "cancelled" (+ optional note), email sent
 * Applicant sees status in their dashboard (GET /status) and receives emails.
 * Membership is free during launch (payments coming soon).
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES } from "../lib/intl.js";
import {
  listApplications, applicationByEmail, applicationById,
  createApplication, updateApplication,
} from "../lib/applications.js";
import { sendMembershipEmail } from "../lib/mailer.js";

const router = Router();

const ADMIN_DASH_URL = (process.env.ADMIN_DASH_URL || "http://localhost:5174").replace(/\/+$/, "");

function provisionMemberProfile(user) {
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
    email: user.email,
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
  return member;
}

function notifyAdmins(applicant, reviewUrl) {
  for (const admin of db.data.users.filter((u) => u.role === "admin")) {
    sendMembershipEmail({ to: admin.email, kind: "new", applicant, reviewUrl }).catch((e) =>
      console.error(`[mail] admin notification to ${admin.email} failed:`, e?.message ?? e));
  }
}

/** POST /api/auth/membership/apply — public application form. */
router.post("/auth/membership/apply", ah(async (req, res) => {
  const { name, email, phone, homeCountry, message } = req.body || {};
  if (!String(name || "").trim() || !isEmail(String(email || ""))) {
    return res.status(400).json({ message: "Name and a valid email address are required." });
  }
  const normalized = String(email).toLowerCase().trim();
  const existingUser = db.data.users.find((u) => u.email === normalized);
  if (existingUser && db.data.members.some((m) => m.email === normalized)) {
    return res.json({ message: "You are already a SwiftKifisha member.", status: "accepted" });
  }
  const existingApp = applicationByEmail(normalized);
  if (existingApp && existingApp.status !== "cancelled") {
    return res.json({ message: "Your application is already with us.", status: existingApp.status });
  }
  const app = createApplication({ name: String(name).trim(), email: normalized, phone, homeCountry, message });
  notifyAdmins(
    { name: app.name, email: app.email, phone: app.phone, homeCountry: app.homeCountry },
    `${ADMIN_DASH_URL}/membership-applications`,
  );
  return res.status(201).json({
    message: "Application received — we'll email you once it's reviewed.",
    status: app.status,
  });
}));

/** GET /api/auth/membership/status — signed-in applicant's own status. */
router.get("/auth/membership/status", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  if (db.data.members.some((m) => m.email === user.email)) {
    return res.json({ status: "accepted", note: "" });
  }
  const app = applicationByEmail(user.email);
  return res.json({
    status: app?.status || (user.role === "admin" ? "accepted" : "pending"),
    note: app?.note || "",
  });
}));

/* ------------------------------ admin review ------------------------------ */

/** GET /api/membership/applications?status= — admin list. */
router.get("/membership/applications", requireAuth, ah(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const rows = listApplications({ status: req.query.status || "" });
  return res.json({ applications: rows });
}));

/** POST /api/membership/applications/:id/action — accept | investigate | cancel. */
router.post("/membership/applications/:id/action", requireAuth, ah(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const app = applicationById(String(req.params.id || ""));
  if (!app) return res.status(404).json({ message: "Application not found." });
  const action = String((req.body || {}).action || "");
  const note = String((req.body || {}).note || "").slice(0, 300);
  if (!["accept", "investigate", "cancel"].includes(action)) {
    return res.status(400).json({ message: "Action must be accept, investigate or cancel." });
  }

  if (action === "accept") {
    let user = db.data.users.find((u) => u.email === app.email);
    if (!user) {
      // Auto-create the login account (passwordless — they will receive OTP-style
      // guidance by email; a member can also reset a password through support).
      const temp = "SwiftKifisha" + Date.now();
      user = {
        _id: objectId(),
        name: app.name,
        email: app.email,
        passwordHash: await bcrypt.hash(temp + app._id, config.bcryptRounds ?? 10),
        role: "member",
        createdAt: new Date().toISOString(),
      };
      db.data.users.push(user);
      db.persist();
    }
    if (!db.data.members.some((m) => m.email === app.email)) {
      provisionMemberProfile(user);
    }
    updateApplication(app._id, { status: "accepted", note, reviewedBy: req.user.email });
    sendMembershipEmail({ to: app.email, kind: "status", status: "accepted", applicant: app, note }).catch((e) =>
      console.error(`[mail] acceptance email to ${app.email} failed:`, e?.message ?? e));
    return res.json({ message: "Membership approved — mailboxes provisioned and applicant emailed.", status: "accepted" });
  }

  const status = action === "investigate" ? "under_review" : "cancelled";
  updateApplication(app._id, { status, note, reviewedBy: req.user.email });
  if (action === "cancel") {
    sendMembershipEmail({ to: app.email, kind: "status", status: "cancelled", applicant: app, note }).catch((e) =>
      console.error(`[mail] cancellation email to ${app.email} failed:`, e?.message ?? e));
  }
  return res.json({ message: `Application ${status === "under_review" ? "flagged for review" : "cancelled"}.`, status });
}));

export default router;
