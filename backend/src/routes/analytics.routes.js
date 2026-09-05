import { Router } from "express";
import { db } from "../lib/db.js";
import {
  monthlyParcelSeries,
  monthlyRevenueSeries,
  topDestinationCities,
  deliveryPerformance,
} from "../lib/aggregate.js";
import { toUgx } from "../lib/pricing.js";
import { ah, requireAuth } from "../middleware/auth.js";

const router = Router();

const parcels = () => db.data.parcels;

/** GET /api/analytics/summary */
router.get("/summary", requireAuth, ah(async (req, res) => {
  const rows = parcels();
  const citiesServed = new Set(rows.map((p) => p.destinationCity)).size;
  return res.json({
    totals: {
      parcels: rows.length,
      international: rows.filter((p) => p.shipmentType === "international").length,
      revenue: rows.reduce((sum, p) => sum + toUgx(p.price, p.currency), 0),
      revenueUSD: Math.round(rows.reduce((sum, p) => sum + (p.currency === "USD" ? Number(p.price) : 0), 0) * 100) / 100,
    },
    citiesServed,
  });
}));

/** GET /api/analytics/revenue  -> [{month, revenue}] */
router.get("/revenue", requireAuth, ah(async (req, res) => res.json(monthlyRevenueSeries(parcels()))));

/** GET /api/analytics/parcels  -> [{month, parcels}] */
router.get("/parcels", requireAuth, ah(async (req, res) => res.json(monthlyParcelSeries(parcels()))));

/** GET /api/analytics/top-cities -> [{city, parcels}] */
router.get("/top-cities", requireAuth, ah(async (req, res) => res.json(topDestinationCities(parcels(), 5))));

/** GET /api/analytics/delivery-performance -> [{month, onTime, delayed}] */
router.get("/delivery-performance", requireAuth, ah(async (req, res) => res.json(deliveryPerformance(parcels()))));

export default router;