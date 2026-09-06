/**
 * Referral & points program (member + admin).
 *
 * - Every user gets a unique referral code (SK-XXXXXX); their promo link is
 *   <frontend>/?ref=CODE. A new sign-up may carry refCode (stored on the new
 *   user as referredBy — no award yet).
 * - When that new user's membership is ACCEPTED, the referrer earns points
 *   (rule referral.pointsPerReferral, default 1000). Award is idempotent per
 *   referred user.
 * - Points live in their own immutable ledger (`points` collection rows) and
 *   can be redeemed for USD wallet credit at the configured value
 *   (referral.pointsValueUsd, default 0.001 USD/pt) with a minimum redemption
 *   (referral.minRedeem, default 1000 pts). Wallet credit then pays shipping
 *   invoices through the normal wallet flow.
 * - Finance can adjust points with a reason (audited); members can never
 *   self-award points.
 */
import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { db } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { addAudit, ruleValue } from "../lib/commerce.js";
import { addLedger, ledgerBalance, money as round } from "../lib/money.js";
import { sendGenericEmail } from "../lib/mailer.js";

const router = Router();
const WEB_URL = (process.env.FRONTEND_URL || config.frontendUrl || "http://localhost:5173").replace(/\/+$/, "");

const memberByToken = (req) => db.data.users.find((u) => u._id === req.user._id);
const requireRole = (roles) => (req, res, next) => {
  const has = (req.user?.role || "").toUpperCase();
  if (!req.user || !roles.some((r) => r.toUpperCase() === has)) {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
};
const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

/* --------------------------------- helpers --------------------------------- */

/** Unique, human-friendly referral code. */
export function freshReferralCode() {
  const used = new Set((db.data.users || []).map((u) => u.referralCode).filter(Boolean));
  for (let i = 0; i < 30; i += 1) {
    const code = "SK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!used.has(code)) return code;
  }
  return "SK-" + Date.now().toString(36).toUpperCase().slice(-6);
}

/** Makes sure the user has a referral code (creates + persists if needed). */
export function ensureReferralCode(user) {
  if (user?.referralCode) return user.referralCode;
  user.referralCode = freshReferralCode();
  db.persist();
  return user.referralCode;
}

export function pointsBalance(email) {
  return (db.data.points || [])
    .filter((p) => p.email === email)
    .reduce((s, p) => s + (p.type === "CREDIT" ? p.points : -p.points), 0);
}

/**
 * Awards the referrer when a referred user's membership is accepted.
 * Idempotent per referred user. Returns the points row or null.
 */
export function awardReferral({ referredUser, actorId, actorEmail, actorRole }) {
  const code = String(referredUser?.referredBy || "").trim().toUpperCase();
  if (!code) return null;
  const referrer = (db.data.users || []).find((u) => String(u.referralCode || "").toUpperCase() === code);
  if (!referrer || referrer._id === referredUser._id) return null;
  const awardedBefore = (db.data.points || []).some(
    (p) => p.refType === "referral" && p.refId === referredUser._id && p.type === "CREDIT",
  );
  if (awardedBefore) return null;
  const points = Math.max(1, Math.round(Number(ruleValue("referral.pointsPerReferral", 1000)) || 1000));
  ensureReferralCode(referrer);
  const row = {
    _id: crypto.randomUUID(),
    email: referrer.email,
    type: "CREDIT",
    points,
    reason: `Referral reward — ${referredUser.email} joined and was accepted`,
    refType: "referral",
    refId: referredUser._id,
    actor: actorEmail || "system",
    createdAt: new Date().toISOString(),
  };
  db.data.points = db.data.points || [];
  db.data.points.push(row);
  db.persist();
  addAudit({ actorId, actorEmail: actorEmail || "system", actorRole: actorRole || "system", action: "REFERRAL_AWARDED", entity: "points", entityId: row._id, changes: { referrer: referrer.email, referred: referredUser.email, points } });
  sendGenericEmail({
    to: referrer.email,
    subject: `You earned ${points} SwiftKifisha points!`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>SwiftKifisha</h2>
      <p>Hi ${referrer.name || "there"}, your referral ${referredUser.email} was accepted — you earned <strong>${points} points</strong>.</p>
      <p>Redeem points for wallet credit in your dashboard and use it to ship your items.</p>
      <p><a href="${WEB_URL}/account/billing">Open billing & points</a></p></div>`,
  }).catch((e) => console.error(`[mail] referral award to ${referrer.email} failed:`, e?.message ?? e));
  return row;
}

/* ------------------------------ member endpoints ------------------------------ */

/** GET /api/referrals — my code, promo link and live stats. */
router.get("/referrals", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const code = ensureReferralCode(user);
  const invited = (db.data.users || []).filter((u) => String(u.referredBy || "").toUpperCase() === String(code).toUpperCase());
  const accepted = invited.filter((u) => {
    const member = (db.data.members || []).find((m) => m.email === u.email);
    return member && (member.status === "accepted" || !member.status) && (db.data.points || []).some((p) => p.refType === "referral" && p.refId === u._id && p.type === "CREDIT");
  });
  return res.json({
    code,
    link: `${WEB_URL}/?ref=${encodeURIComponent(code)}`,
    stats: { invitedSignups: invited.length, accepted: accepted.length, balance: pointsBalance(user.email) },
  });
}));

/** GET /api/referrals/points — balance + history. */
router.get("/referrals/points", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const rows = (db.data.points || []).filter((p) => p.email === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  return res.json({ balance: pointsBalance(user.email), entries: rows });
}));

/**
 * POST /api/referrals/redeem { points } — converts points to USD wallet
 * credit at the configured rate (audited; points ledger is immutable).
 */
router.post("/referrals/redeem", requireAuth, ah(async (req, res) => {
  const user = memberByToken(req);
  const pts = Math.floor(Number((req.body || {}).points) || 0);
  const minRedeem = Math.max(1, Math.round(Number(ruleValue("referral.minRedeem", 1000)) || 1000));
  if (pts < minRedeem) {
    return res.status(400).json({ message: `Minimum redemption is ${minRedeem} points.` });
  }
  const balance = pointsBalance(user.email);
  if (pts > balance) {
    return res.status(409).json({ message: `You have ${balance} points — enter ${balance >= minRedeem ? "an amount up to " + balance : "at least " + minRedeem} points.` });
  }
  const valueUsd = Math.max(0, Number(ruleValue("referral.pointsValueUsd", 0.001)) || 0.001);
  const usd = round(pts * valueUsd);
  if (usd <= 0) return res.status(400).json({ message: "Redemption value is too small." });
  db.data.points = db.data.points || [];
  db.data.points.push({
    _id: crypto.randomUUID(),
    email: user.email,
    type: "DEBIT",
    points: pts,
    reason: `Redeemed ${pts} points → ${usd} USD wallet credit`,
    refType: "redeem",
    refId: null,
    actor: user.email,
    createdAt: new Date().toISOString(),
  });
  const entry = addLedger({
    email: user.email, type: "CREDIT", amount: usd, currency: "USD",
    reason: `Referral points redemption (${pts} pts)`, refType: "points", refId: null, actor: user.email,
  });
  db.persist();
  addAudit({ actorId: user._id, actorEmail: user.email, actorRole: user.role, action: "POINTS_REDEEMED", entity: "points", entityId: entry._id, changes: { points: pts, usd, ledgerId: entry._id } });
  return res.json({
    message: `${pts} points redeemed for ${usd} USD wallet credit.`,
    pointsDebited: pts, usdCredited: usd, balance: pointsBalance(user.email),
    walletBalance: round(ledgerBalance(user.email, "USD")),
  });
}));

/* ------------------------------ admin endpoints ------------------------------ */

/** GET /api/admin/referrals — program overview (finance). */
router.get("/admin/referrals", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const { search } = req.query;
  const rows = (db.data.users || [])
    .filter((u) => u.referralCode || u.referredBy)
    .map((u) => ({
      email: u.email, name: u.name, referralCode: u.referralCode || null,
      invited: (db.data.users || []).filter((x) => String(x.referredBy || "").toUpperCase() === String(u.referralCode || "").toUpperCase()).length,
      points: pointsBalance(u.email),
    }))
    .filter((r) => !search || (r.email || "").toLowerCase().includes(String(search).toLowerCase()) || String(r.referralCode || "").toLowerCase().includes(String(search).toLowerCase()))
    .sort((a, b) => b.points - a.points);
  return res.json({ referrals: rows });
}));

/** POST /api/admin/referrals/adjust { email, points (±), reason } — finance only. */
router.post("/admin/referrals/adjust", requireAuth, requireRole(FINANCE_ROLES), ah(async (req, res) => {
  const { email, points, reason } = req.body || {};
  const target = (db.data.users || []).find((u) => u.email === String(email || "").toLowerCase().trim());
  if (!target) return res.status(404).json({ message: "No user with that email." });
  const pts = Math.round(Number(points) || 0);
  if (!pts) return res.status(400).json({ message: "Points must be a non-zero whole number (positive credit, negative debit)." });
  if (!String(reason || "").trim()) return res.status(400).json({ message: "A reason is required." });
  const row = {
    _id: crypto.randomUUID(),
    email: target.email,
    type: pts > 0 ? "CREDIT" : "DEBIT",
    points: Math.abs(pts),
    reason: String(reason).trim().slice(0, 300),
    refType: "adjustment",
    refId: null,
    actor: req.user.email,
    createdAt: new Date().toISOString(),
  };
  db.data.points = db.data.points || [];
  db.data.points.push(row);
  db.persist();
  addAudit({ actorId: req.user._id, actorEmail: req.user.email, actorRole: req.user.role, action: "POINTS_ADJUSTED", entity: "points", entityId: row._id, reason: String(reason).trim().slice(0, 300), changes: { email: target.email, points: pts } });
  return res.json({ message: `Adjusted ${target.email} by ${pts} points.`, balance: pointsBalance(target.email) });
}));

export default router;
