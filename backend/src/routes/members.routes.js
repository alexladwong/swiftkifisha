import { Router } from "express";
import { db } from "../lib/db.js";
import { toUgx } from "../lib/pricing.js";
import { clamp, escapeRegExp } from "../lib/util.js";
import { ah, requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/members?page=&limit=&search=  (admin)
 * Every member enriched with their shipment totals.
 */
router.get("/", requireAuth, ah(async (req, res) => {
  const page = clamp(parseInt(req.query.page, 10) || 1, 1, 100000);
  const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 100);
  const search = String(req.query.search || "").trim();

  const statsByMember = new Map();
  for (const p of db.data.parcels) {
    if (!p.memberId) continue;
    const st = statsByMember.get(p.memberId) || { parcels: 0, international: 0, revenuePkr: 0, revenueUSD: 0, delivered: 0 };
    st.parcels += 1;
    st.revenuePkr += toUgx(p.price, p.currency);
    if (p.currency === "USD") st.revenueUSD += Number(p.price) || 0;
    if (p.shipmentType === "international") st.international += 1;
    if ((p.checkpoints || []).some((c) => c.status === "delivered")) st.delivered += 1;
    statsByMember.set(p.memberId, st);
  }

  let rows = db.data.members.map((m) => {
    const st = statsByMember.get(m._id) || { parcels: 0, international: 0, revenuePkr: 0, revenueUSD: 0, delivered: 0 };
    const lastParcel = db.data.parcels
      .filter((p) => p.memberId === m._id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return {
      _id: m._id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      plan: m.plan,
      memberCode: m.memberCode,
      homeCountry: m.homeCountry,
      homeCity: m.homeCity,
      joinedAt: m.joinedAt,
      hubAddresses: m.hubAddresses || [],
      totals: {
        parcels: st.parcels,
        international: st.international,
        delivered: st.delivered,
        revenuePkr: st.revenuePkr,
        revenueUSD: Math.round(st.revenueUSD * 100) / 100,
      },
      lastShipmentAt: lastParcel?.createdAt || null,
    };
  });

  if (search) {
    const re = new RegExp(escapeRegExp(search), "i");
    rows = rows.filter((m) => re.test(m.name) || re.test(m.email) || re.test(m.memberCode) || re.test(m.homeCountry));
  }
  rows.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const data = rows.slice((safePage - 1) * limit, safePage * limit);
  return res.json({ data, page: safePage, limit, total, totalPages });
}));

/** GET /api/members/me (member, token-bound) - own profile */
router.get("/me", requireAuth, ah(async (req, res) => {
  const member = db.data.members.find((m) => m.email === req.user.email);
  if (!member) return res.status(404).json({ message: "Member profile not found." });
  return res.json({ member });
}));

/** GET /api/members/me/parcels (member) - own shipments */
router.get("/me/parcels", requireAuth, ah(async (req, res) => {
  const limit = clamp(parseInt(req.query.limit, 10) || 10, 1, 50);
  const member = db.data.members.find((m) => m.email === req.user.email);
  if (!member) return res.status(404).json({ message: "Member profile not found." });
  const rows = db.data.parcels
    .filter((p) => p.memberId === member._id || p.memberEmail === member.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ data: rows.slice(0, limit), total: rows.length, limit });
}));

/** PATCH /api/members/me (member) - update own profile */
router.patch("/me", requireAuth, ah(async (req, res) => {
  const member = db.data.members.find((m) => m.email === req.user.email);
  if (!member) return res.status(404).json({ message: "Member profile not found." });
  const { name, phone, homeCity, homeCountry } = req.body || {};
  if (name !== undefined && String(name).trim()) member.name = String(name).trim();
  if (phone !== undefined && String(phone).trim()) member.phone = String(phone).trim();
  if (homeCity !== undefined && String(homeCity).trim()) member.homeCity = String(homeCity).trim();
  if (homeCountry !== undefined && String(homeCountry).trim()) member.homeCountry = String(homeCountry).trim();
  const user = db.data.users.find((u) => u.email === member.email);
  if (user && name !== undefined && String(name).trim()) user.name = member.name;
  db.persist();
  return res.json({ message: "Profile updated successfully", member });
}));


/** GET /api/members/:id  (admin) — member profile + hub addresses + recent parcels. */
router.get("/:id", requireAuth, ah(async (req, res) => {
  const member = db.data.members.find((m) => m._id === req.params.id);
  if (!member) return res.status(404).json({ message: "Member not found." });
  const recentParcels = db.data.parcels
    .filter((p) => p.memberId === member._id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 25);
  return res.json({ member, parcels: recentParcels });
}));

export default router;