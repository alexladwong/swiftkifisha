import { Router } from "express";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES, MEMBER_PLANS, WORLD_COUNTRIES_WITH_CAPITALS } from "../lib/intl.js";
import { ah } from "../middleware/auth.js";

const router = Router();

const HUB_PERKS = {
  "United States": ["Shop thousands of US online stores", "Free 30-day consolidation", "Repackaging and photo on request"],
  "United Kingdom": ["High-street and online favourites", "VAT-exempt mailbox handling", "Ship to Europe within days"],
  "United Arab Emirates": ["Gateway to the Middle East", "noon, Amazon.ae and more", "Fast Gulf delivery lanes"],
  Germany: ["European e-commerce hub", "Zalando, Amazon.de, Otto", "Rail & road links across the EU"],
  China: ["Factory-direct deals", "AliExpress, Tmall, Shein and more", "E-commerce consolidation experts"],
  Singapore: ["Clean, fast Southeast Asia hub", "Shopee, Lazada and more", "Regional redistribution"],
  "Hong Kong": ["Duty-free shopping hub", "HKTVmall, Lazada HK and more", "Same-week Asia delivery"],
};

/** GET /api/shop/hubs  (public) — mailbox countries offered to members. */
router.get("/hubs", ah(async (_req, res) => {
  const hubs = HUB_COUNTRIES.map((h) => ({
    id: h.code,
    country: h.country,
    city: h.city,
    currency: h.currency,
    pickupFee: h.pickupFee,
    addressLines: HUB_MAILBOX_EXAMPLES[h.country] || [],
    perks: HUB_PERKS[h.country] || [],
  }));
  return res.json({ hubs });
}));

/** GET /api/shop/world  (public) — served destination countries. */
router.get("/world", ah(async (_req, res) => {
  return res.json({ countries: WORLD_COUNTRIES_WITH_CAPITALS, plans: MEMBER_PLANS });
}));

export default router;
