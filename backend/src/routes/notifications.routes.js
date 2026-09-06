/**
 * Customer contact messages, admin inbox + replies, and announcements.
 * Mounted at /api (paths below). All rows live in db.data and are persisted +
 * Neon-synced (remoteStore.SYNC_COLLECTIONS).
 *
 * messages:  { _id, email, name, direction: "in"|"out", subject, body,
 *              read: false, createdAt }
 *            "in"  = customer → admins   (read marks admin notification)
 *            "out" = admin → customer    (read marks member notification)
 *            A thread is everything with the same `email`.
 * announcements: { _id, title, body, type, audience:"all"|"region", region,
 *              createdBy, createdAt }
 */
import { Router } from "express";
import crypto from "node:crypto";
import { db, objectId } from "../lib/db.js";
import { ah, requireAuth } from "../middleware/auth.js";
import { isEmail } from "../lib/util.js";
import { sendGenericEmail } from "../lib/mailer.js";

const router = Router();
const ADMIN_DASH_URL = (process.env.ADMIN_DASH_URL || "http://localhost:5174").replace(/\/+$/, "");

function notifyAdmins(message) {
  for (const admin of (db.data.users || []).filter((u) => u.role === "admin")) {
    sendGenericEmail({
      to: admin.email,
      subject: `New customer message: ${message.subject}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2>SwiftKifisha — new contact message</h2>
        <p><strong>${message.name}</strong> &lt;${message.email}&gt;</p>
        <p style="color:#0f172a">${String(message.body).replace(/</g, "&lt;")}</p>
        <p><a href="${ADMIN_DASH_URL}/messages">Open admin inbox</a></p>
      </div>`,
    }).catch((e) => console.error(`[mail] admin notify ${admin.email} failed:`, e?.message ?? e));
  }
}

/* --------------------------- customer contact form --------------------------- */

/** POST /api/contact — public contact form (stored, notifies admins). */
router.post("/contact", ah(async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!String(name || "").trim() || !isEmail(String(email || "")) || !String(message || "").trim()) {
    return res.status(400).json({ message: "Name, a valid email and a message are required." });
  }
  const row = {
    _id: crypto.randomUUID(),
    email: String(email).toLowerCase().trim(),
    name: String(name).trim().slice(0, 80),
    subject: String(subject || "General inquiry").slice(0, 120),
    body: String(message).trim().slice(0, 4000),
    direction: "in",
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.data.messages = db.data.messages || [];
  db.data.messages.push(row);
  db.persist();
  notifyAdmins(row);
  // Courtesy ack to the customer.
  sendGenericEmail({
    to: row.email,
    subject: "We received your message — SwiftKifisha",
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2>SwiftKifisha</h2>
      <p>Hi ${row.name}, thanks for reaching out. We received your message and will reply within 24 hours.</p>
      <p style="color:#64748b">"${String(row.body).replace(/</g, "&lt;").slice(0, 400)}"</p>
    </div>`,
  }).catch(() => {});
  return res.status(201).json({ message: "Message sent — we'll get back to you within 24 hours." });
}));

/* ------------------------------ member thread ------------------------------ */

/** GET /api/messages/me — the signed-in member's thread with support. */
router.get("/messages/me", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const rows = (db.data.messages || [])
    .filter((m) => m.email === user.email)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let unread = 0;
  for (const m of rows) {
    if (m.direction === "out" && !m.read) unread += 1;
  }
  // Mark admin replies as read by the member (they are viewing them now).
  if (unread > 0) {
    for (const m of rows) if (m.direction === "out") m.read = true;
    db.persist();
  }
  return res.json({ messages: rows, unread: 0 });
}));

/** GET /api/messages/me/unread-count — member badge (does not mark read). */
router.get("/messages/me/unread-count", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const unread = (db.data.messages || []).filter((m) => m.email === user.email && m.direction === "out" && !m.read).length;
  return res.json({ unread });
}));

/**
 * GET /api/notifications/summary — member bell: unread support replies plus
 * the latest announcements that target them.
 */
router.get("/notifications/summary", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const member = (db.data.members || []).find((m) => m.email === user.email);
  const regions = new Set(member ? [member.homeCountry] : []);
  for (const p of db.data.parcels || []) {
    if (p.memberEmail === user.email && p.destinationCountry) regions.add(p.destinationCountry);
  }
  const recent = [...(db.data.announcements || [])]
    .filter((a) => a.audience === "all" || (a.region && regions.has(a.region)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  const unreadMessages = (db.data.messages || []).filter(
    (m) => m.email === user.email && m.direction === "out" && !m.read,
  ).length;
  return res.json({ unreadMessages, announcements: recent });
}));

/** POST /api/messages/me — member writes to support. */
router.post("/messages/me", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const body = String((req.body || {}).body || "").trim();
  if (!body) return res.status(400).json({ message: "Message is required." });
  db.data.messages = db.data.messages || [];
  db.data.messages.push({
    _id: crypto.randomUUID(),
    email: user.email,
    name: user.name,
    subject: String((req.body || {}).subject || "Member message").slice(0, 120),
    body: body.slice(0, 4000),
    direction: "in",
    read: false,
    createdAt: new Date().toISOString(),
  });
  db.persist();
  const row = db.data.messages[db.data.messages.length - 1];
  notifyAdmins(row);
  return res.status(201).json({ message: "Message sent to our team." });
}));

/* -------------------------------- admin inbox -------------------------------- */

/** GET /api/messages — admin inbox (all threads, newest first). */
router.get("/messages", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const rows = [...(db.data.messages || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = rows.filter((m) => m.direction === "in" && !m.read).length;
  return res.json({ messages: rows, unread });
}));

/** GET /api/messages/admin/unread-count — badge count for the dashboard. */
router.get("/messages/admin/unread-count", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  return res.json({ unread: (db.data.messages || []).filter((m) => m.direction === "in" && !m.read).length });
}));

/** POST /api/messages/:id/read — mark inbound as read. */
router.post("/messages/:id/read", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const row = (db.data.messages || []).find((m) => m._id === req.params.id);
  if (!row) return res.status(404).json({ message: "Message not found." });
  row.read = true;
  db.persist();
  return res.json({ ok: true });
}));

/** POST /api/messages/reply — direct reply to a customer (stored + emailed). */
router.post("/messages/reply", requireAuth, ah(async (req, res) => {
  const admin = db.data.users.find((u) => u._id === req.user._id);
  if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const { email, body, subject } = req.body || {};
  const targetEmail = String(email || "").toLowerCase().trim();
  if (!isEmail(targetEmail) || !String(body || "").trim()) {
    return res.status(400).json({ message: "Customer email and a reply message are required." });
  }
  const customer = db.data.users.find((u) => u.email === targetEmail)
    || (db.data.members || []).find((m) => m.email === targetEmail)
    || (db.data.applications || []).find((a) => a.email === targetEmail);
  db.data.messages = db.data.messages || [];
  db.data.messages.push({
    _id: crypto.randomUUID(),
    email: targetEmail,
    name: customer?.name || targetEmail.split("@")[0],
    subject: String(subject || "SwiftKifisha support").slice(0, 120),
    body: String(body).trim().slice(0, 4000),
    direction: "out",
    read: false,
    createdAt: new Date().toISOString(),
  });
  db.persist();
  await sendGenericEmail({
    to: targetEmail,
    subject: String(subject || "Reply from SwiftKifisha support"),
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2>SwiftKifisha</h2>
      <p>Hi ${customer?.name || "there"},</p>
      <p style="color:#0f172a">${String(body).replace(/</g, "&lt;")}</p>
      <p style="font-size:12px;color:#94a3b8">— SwiftKifisha support team<br/>Replies also appear in your member dashboard.</p>
    </div>`,
  }).catch(() => {});
  return res.status(201).json({ message: "Reply sent to the customer." });
}));

/* ------------------------------- announcements ------------------------------- */

/** POST /api/announcements — admin only. audience: all | region. */
router.post("/announcements", requireAuth, ah(async (req, res) => {
  const admin = db.data.users.find((u) => u._id === req.user._id);
  if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const { title, body, type, audience, region } = req.body || {};
  if (!String(title || "").trim() || !String(body || "").trim()) {
    return res.status(400).json({ message: "Title and body are required." });
  }
  const ann = {
    _id: crypto.randomUUID(),
    title: String(title).trim().slice(0, 160),
    body: String(body).trim().slice(0, 6000),
    type: String(type || "general").slice(0, 40),
    audience: audience === "region" ? "region" : "all",
    region: audience === "region" ? String(region || "").trim() : "",
    createdBy: admin.email,
    createdAt: new Date().toISOString(),
  };
  db.data.announcements = db.data.announcements || [];
  db.data.announcements.push(ann);
  db.persist();

  // Distribute by email to the targeted members.
  const recipients = [];
  for (const m of db.data.members || []) {
    if (ann.audience === "all") recipients.push(m);
    else if (m.homeCountry === ann.region) recipients.push(m);
  }
  if (ann.audience === "region") {
    const seen = new Set(recipients.map((m) => m.email));
    for (const p of db.data.parcels || []) {
      if (p.destinationCountry === ann.region && p.memberEmail && !seen.has(p.memberEmail)) {
        seen.add(p.memberEmail);
        const member = (db.data.members || []).find((m) => m.email === p.memberEmail);
        if (member) recipients.push(member);
      }
    }
  }
  for (const member of recipients) {
    sendGenericEmail({
      to: member.email,
      subject: `[${ann.type}] ${ann.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2>${ann.title}</h2>
        <p style="color:#0f172a">${String(ann.body).replace(/</g, "&lt;")}</p>
        <p style="font-size:12px;color:#94a3b8">SwiftKifisha announcement — you can also read this in your member dashboard.</p>
      </div>`,
    }).catch((e) => console.error(`[mail] announcement to ${member.email} failed:`, e?.message ?? e));
  }
  return res.status(201).json({ message: `Announcement published to ${recipients.length} member(s).`, recipients: recipients.length });
}));

/** GET /api/announcements/regions — countries used for region targeting. */
router.get("/announcements/regions", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const set = new Set();
  for (const m of db.data.members || []) if (m.homeCountry) set.add(m.homeCountry);
  for (const p of db.data.parcels || []) {
    if (p.destinationCountry) set.add(p.destinationCountry);
    if (p.originCountry) set.add(p.originCountry);
  }
  return res.json({ regions: [...set].sort() });
}));

/** GET /api/announcements — admin history. */
router.get("/announcements", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  const rows = [...(db.data.announcements || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ announcements: rows });
}));

/**
 * GET /api/announcements/feed — member feed: global + region-matched
 * announcements (their home country or any parcel destination country).
 */
router.get("/announcements/feed", requireAuth, ah(async (req, res) => {
  const user = db.data.users.find((u) => u._id === req.user._id);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const member = (db.data.members || []).find((m) => m.email === user.email);
  const regions = new Set(member ? [member.homeCountry] : []);
  for (const p of db.data.parcels || []) {
    if (p.memberEmail === user.email && p.destinationCountry) regions.add(p.destinationCountry);
  }
  const rows = [...(db.data.announcements || [])]
    .filter((a) => a.audience === "all" || (a.region && regions.has(a.region)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ announcements: rows });
}));

export default router;
