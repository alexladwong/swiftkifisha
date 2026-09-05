import { Router } from "express";
import { db } from "../lib/db.js";
import {
  statusDistribution,
  monthlyParcelSeries,
  monthlyRevenueSeries,
  weightDistribution,
} from "../lib/aggregate.js";
import { toUgx } from "../lib/pricing.js";
import { ah, requireAuth } from "../middleware/auth.js";

const router = Router();

/** GET /api/dashboard/stats  (admin) — home dashboard cards + charts. */
router.get("/stats", requireAuth, ah(async (req, res) => {
  const parcels = db.data.parcels;
  const statusRows = statusDistribution(parcels);
  const total = parcels.length;

  return res.json({
    totals: {
      parcels: total,
      international: parcels.filter((p) => p.shipmentType === "international").length,
      revenue: parcels.reduce((sum, p) => sum + toUgx(p.price, p.currency), 0),
      revenueUSD: Math.round(parcels.reduce((sum, p) => sum + (p.currency === "USD" ? Number(p.price) : 0), 0) * 100) / 100,
    },
    statusDistribution: statusRows,
    monthlyParcels: monthlyParcelSeries(parcels),
    monthlyRevenue: monthlyRevenueSeries(parcels),
    weightDistribution: weightDistribution(parcels),
  });
}));

export default router;