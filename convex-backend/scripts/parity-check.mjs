// Logic parity harness: runs the Convex TS libs and the Express JS libs over
// the SAME seeded dataset and asserts identical outputs (pricing + analytics).
import fs from "node:fs";
import assert from "node:assert";

// Convex implementations (TypeScript, executed via tsx)
import * as convPrice from "../convex/lib/pricing.ts";
import * as convAgg from "../convex/lib/agg.ts";

// Express implementations (JavaScript)
import * as expPrice from "../../backend/src/lib/pricing.js";
import * as expAgg from "../../backend/src/lib/aggregate.js";

const db = JSON.parse(fs.readFileSync(new URL("../../backend/data/db.json", import.meta.url), "utf8"));
const parcels = db.parcels;

let checks = 0;
const ok = (name) => { checks += 1; console.log("  PASS parity:", name); };
const fail = (name, e) => { console.error("  FAIL parity:", name, "\n   ", e?.message?.slice(0, 400)); process.exitCode = 1; };

// ---- 1) pricing matrix across routes/categories/weights/deliveries/origins ----
const shipmentTypes = ["national", "international"];
const categories = ["document","electronics","fragile","clothing","food","medicine","cosmetics","books","small_package","large_package"];
const deliveryTypes = ["sameDay", "overnight", "standard"];
const weights = [0.1, 0.5, 1, 2.5, 9.9, 15, 40];
const origins = ["United States","United Kingdom","United Arab Emirates","Germany","China","Singapore","Hong Kong"];
const destinations = ["Uganda","United Kingdom","United States","Singapore","Germany","Brazil","Australia"];
let priceDiffs = 0;
for (const shipmentType of shipmentTypes) {
  for (const parcelCategory of categories) {
    for (const deliveryType of deliveryTypes) {
      for (const weight of weights) {
        if (shipmentType === "national") {
          const a = expPrice.calculatePrice({ shipmentType, parcelCategory, weight, deliveryType });
          const b = convPrice.calculatePrice({ shipmentType, parcelCategory, weight, deliveryType });
          if (a.price !== b.price || a.currency !== b.currency) { priceDiffs += 1; if (priceDiffs < 4) console.log("  DIFF", shipmentType, parcelCategory, weight, deliveryType, a, b); }
        } else {
          for (const originCountry of origins) {
            for (const destinationCountry of destinations) {
              const a = expPrice.calculatePrice({ shipmentType, parcelCategory, weight, deliveryType, originCountry, destinationCountry });
              const b = convPrice.calculatePrice({ shipmentType, parcelCategory, weight, deliveryType, originCountry, destinationCountry });
              if (a.price !== b.price || a.currency !== b.currency) { priceDiffs += 1; if (priceDiffs < 4) console.log("  DIFF", shipmentType, parcelCategory, weight, deliveryType, originCountry, destinationCountry, a, b); }
            }
          }
        }
      }
    }
  }
}
if (priceDiffs === 0) ok("pricing matrix (" + (3 * 10 * 3 * 7 * 7 * 6 + 3 * 10 * 3 * 7) + " combos)");
else fail("pricing matrix", new Error(priceDiffs + " mismatches"));

// ---- 2) aggregations over the seeded dataset (fixed 'now') ----
const now = new Date("2026-09-05T12:00:00Z");
const aggNames = [
  "statusDistribution",
  "monthlyParcelSeries",
  "monthlyRevenueSeries",
  "weightDistribution",
  "topDestinationCities",
];
for (const fn of aggNames) {
  try {
    const a = expAgg[fn](parcels);
    const b = convAgg[fn](parcels);
    assert.deepStrictEqual(b, a);
    ok("aggregate " + fn);
  } catch (e) { fail("aggregate " + fn, e); }
}
try {
  const a = expAgg.deliveryPerformance(parcels, now);
  const b = convAgg.deliveryPerformance(parcels, now);
  assert.deepStrictEqual(b, a);
  ok("aggregate deliveryPerformance (fixed now)");
} catch (e) { fail("aggregate deliveryPerformance", e); }

// ---- 3) currentStatus helper ----
try {
  for (const p of parcels.slice(0, 50)) {
    assert.strictEqual(convAgg.currentStatus(p), expAgg.currentStatusOf(p));
  }
  ok("currentStatus helper (50 samples)");
} catch (e) { fail("currentStatus helper", e); }

// ---- 4) FX conversion ----
try {
  const usdDoc = [{ createdAt: "2026-08-01T00:00:00.000Z", price: 100, currency: "USD", checkpoints: [] }];
  assert.strictEqual(convAgg.monthlyRevenueSeries(usdDoc)[0].revenue, expAgg.monthlyRevenueSeries(usdDoc)[0].revenue);
  ok("USD->UGX revenue conversion at 3700");
} catch (e) { fail("USD->UGX conversion", e); }


// ---- 5) quote endpoint parity: live Express API vs Convex quotePayload ----
import * as convParcels from "../convex/parcels.ts";
import * as expUtil from "../../backend/src/lib/util.js";

const BASE = "http://localhost:5001/api";
const apiPost = async (path, body) => {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let b = null; try { b = await res.json(); } catch {}
  return { status: res.status, body: b };
};
const quoteCases = [
  { name: "national document", payload: { shipmentType: "national", originCity: "Kampala", destinationCity: "Jinja", parcelCategory: "document", weight: 1, deliveryType: "standard" } },
  { name: "intl US to Uganda", payload: { shipmentType: "international", originCountry: "United States", destinationCountry: "Uganda", destinationCity: "Kampala", parcelCategory: "electronics", weight: 2, deliveryType: "overnight" } },
  { name: "intl China city strings", payload: { shipmentType: "international", originCountry: "China", originCity: "Shanghai, China", destinationCountry: "United Kingdom", destinationCity: "United Kingdom, London", parcelCategory: "small_package", weight: 1.2, deliveryType: "standard" } },
  { name: "intl Germany heavy priority", payload: { shipmentType: "international", originCountry: "Germany", destinationCountry: "United Arab Emirates", destinationCity: "United Arab Emirates, Abu Dhabi", parcelCategory: "large_package", weight: 17, deliveryType: "sameDay" } },
  { name: "intl hub default origin city", payload: { shipmentType: "international", originCountry: "Singapore", destinationCountry: "Australia", destinationCity: "Australia, Canberra", parcelCategory: "clothing", weight: 3, deliveryType: "standard" } },
];
for (const c of quoteCases) {
  try {
    const live = await apiPost("/parcels/calculate-cost", c.payload);
    if (live.status !== 200) throw new Error("express returned " + live.status + " " + JSON.stringify(live.body));
    const conv = convParcels.quotePayload({ ...c.payload });
    assert.deepStrictEqual(conv, live.body);
    ok("quote payload parity: " + c.name);
  } catch (e) { fail("quote payload parity: " + c.name, e); }
}

// ---- 6) checkpoint dateTime formatting parity ----
try {
  const samples = ["2026-01-12T14:05:00.000Z", "2025-06-30T23:59:59.000Z", "2026-09-05T00:00:00.000Z", "2024-12-25T08:30:00.000Z"];
  for (const iso of samples) {
    const conv = convParcels.checkpointRecord({ status: "arrived", location: "X", message: "M", at: new Date(iso) });
    const expected = expUtil.formatDateTime(iso);
    assert.strictEqual(conv.dateTime, expected);
    assert.strictEqual(conv.timestamp, iso);
  }
  ok("checkpoint dateTime formatting (4 samples)");
} catch (e) { fail("checkpoint dateTime formatting", e); }

console.log("\n" + (process.exitCode ? "PARITY FAILURES DETECTED" : "ALL " + checks + " PARITY CHECKS PASSED"));