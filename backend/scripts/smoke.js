/**
 * End-to-end smoke test against a running API.
 * Usage: node scripts/smoke.js [baseUrl]
 * Exercises every route the two frontends use.
 */
const base = (process.argv[2] || "http://localhost:5001/api").replace(/\/$/, "");

let failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failed += 1; console.log(`  FAIL  ${name} ${extra}`); }
};
const j = async (path, opts = {}) => {
  const res = await fetch(base + path, {
    headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    ...opts.fetch,
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-json */ }
  return { status: res.status, body };
};

console.log(`Smoke testing ${base}\n`);

// health
{
  const r = await j("/health");
  check("GET /health", r.status === 200 && r.body?.status === "ok", JSON.stringify(r.body));
}

// login
let token = null;
{
  const bad = await j("/auth/login", { fetch: { method: "POST", body: JSON.stringify({ email: "admin@swiftship.com", password: "wrong" }) } });
  check("login rejects bad credentials", bad.status === 401);
  const ok = await j("/auth/login", { fetch: { method: "POST", body: JSON.stringify({ email: "admin@swiftship.com", password: "Admin@123" }) } });
  check("login returns token + user", ok.status === 200 && !!ok.body?.token && ok.body?.user?.role === "admin", JSON.stringify(ok.body).slice(0, 140));
  token = ok.body?.token;
}

// add-user (unique email per run so the test stays repeatable)
{
  const unique = `smoke-${Date.now()}@swiftship.com`;
  const r = await j("/auth/add-user", { token, fetch: { method: "POST", body: JSON.stringify({ name: "Smoke Admin", email: unique, password: "Smoke@123" }) } });
  check("add-user creates admin", r.status === 201 && r.body?.user?.email === unique, JSON.stringify(r.body).slice(0, 160));
  const dup = await j("/auth/add-user", { token, fetch: { method: "POST", body: JSON.stringify({ name: "X", email: unique, password: "Smoke@123" }) } });
  check("add-user rejects duplicate email", dup.status === 409);
}

// auth guard on admin routes
{
  const r = await j("/parcels");
  check("GET /parcels requires auth", r.status === 401);
}

// list parcels
let created = null;
{
  const r = await j("/parcels?page=1&limit=5&search=UG-", { token });
  check("GET /parcels shape", r.status === 200 && Array.isArray(r.body?.data) && r.body.data.length === 5 && typeof r.body.total === "number", JSON.stringify({ page: r.body?.page, total: r.body?.total, totalPages: r.body?.totalPages }));
  const first = r.body?.data?.[0];
  check("parcel fields present", first && first._id && first.trackingId && first.checkpoints?.length > 0 && first.senderName && first.price, JSON.stringify(first).slice(0, 220));
}

// create parcel
{
  const r = await j("/parcels", { token, fetch: { method: "POST", body: JSON.stringify({
    senderName: "Smoke Sender", senderPhone: "+256-700-123456", senderAddress: "House 1, Kololo, Kampala",
    receiverName: "Smoke Receiver", receiverPhone: "+256-701-765432", receiverAddress: "House 2, Ntinda, Kampala",
    shipmentType: "national", originCity: "Kampala", destinationCity: "Jinja",
    deliveryType: "standard", parcelCategory: "small_package", weight: 2,
  }) } });
  created = r.body;
  check("create parcel returns trackingId", r.status === 201 && /^UG-/.test(r.body?.trackingId || ""), JSON.stringify(r.body).slice(0, 200));
  check("created parcel has price", Number.isFinite(Number(r.body?.price)) && r.body?.price > 0);
}

// calculate cost
{
  const r = await j("/parcels/calculate-cost", { fetch: { method: "POST", body: JSON.stringify({ originCity: "Kampala" }) } });
  check("calculate-cost rejects incomplete body", r.status === 400);
  const ok = await j("/parcels/calculate-cost", { fetch: { method: "POST", body: JSON.stringify({
    originCity: "Kampala", destinationCity: "Jinja", shipmentType: "national",
    parcelCategory: "electronics", weight: 5, deliveryType: "overnight",
  }) } });
  check("calculate-cost returns quote", ok.status === 200 && ok.body?.type === "overnight" && ok.body?.price > 0 && ok.body?.parcelCategory === "electronics", JSON.stringify(ok.body));
}

// public track (with alias keys used by the customer site)
if (created?._id) {
  const r = await j(`/parcels/track/${created.trackingId}`);
  check("track by trackingId (public)", r.status === 200 && r.body?.trackingId === created.trackingId);
  check("customer alias keys present", r.body?.trackingID === created.trackingId && r.body?.shimpentType === "national" && r.body?.Weight === 2);
  const cp = r.body?.checkpoints?.[0];
  check("checkpoint display fields", cp && cp.status && cp.location && cp.message && cp.timestamp && cp.timestamps && cp.dateTime, JSON.stringify(cp).slice(0, 200));
  const miss = await j("/parcels/track/UG-NOPE-000000");
  check("track miss returns 404", miss.status === 404);
}

// checkpoint
if (created?._id) {
  const r = await j(`/parcels/${created._id}/checkpoint`, { token, fetch: { method: "POST", body: JSON.stringify({ location: "Kampala", title: "In transit", description: "Departed Kampala hub", status: "in_transit" }) } });
  check("checkpoint appended", r.status === 200 && r.body?.checkpoints?.length === 2 && r.body?.status === "in_transit");
  const unauth = await j(`/parcels/${created._id}/checkpoint`, { fetch: { method: "POST", body: JSON.stringify({ location: "X", title: "Y", status: "delivered" }) } });
  check("checkpoint requires auth", unauth.status === 401);
}

// dashboard stats
{
  const r = await j("/dashboard/stats", { token });
  const b = r.body || {};
  check("dashboard stats shape", r.status === 200
    && typeof b.totals?.parcels === "number" && b.totals.parcels > 0
    && Array.isArray(b.statusDistribution) && b.statusDistribution.length === 4
    && Array.isArray(b.monthlyParcels) && b.monthlyParcels.length === 6
    && Array.isArray(b.monthlyRevenue) && b.monthlyRevenue.length === 6
    && Array.isArray(b.weightDistribution) && b.weightDistribution.length === 5,
    JSON.stringify({ totals: b.totals, sd: b.statusDistribution, wp: b.weightDistribution }).slice(0, 220));
}

// analytics endpoints
{
  const summary = await j("/analytics/summary", { token });
  check("analytics summary", summary.status === 200 && typeof summary.body?.totals?.revenue === "number" && typeof summary.body?.citiesServed === "number", JSON.stringify(summary.body));
  const revenue = await j("/analytics/revenue", { token });
  check("analytics revenue series", revenue.status === 200 && revenue.body.length === 6 && revenue.body.every((m) => typeof m.revenue === "number" && !!m.month));
  const growth = await j("/analytics/parcels", { token });
  check("analytics parcel growth series", growth.status === 200 && growth.body.length === 6 && growth.body.every((m) => typeof m.parcels === "number"));
  const cities = await j("/analytics/top-cities", { token });
  check("analytics top cities", cities.status === 200 && cities.body.length <= 5 && cities.body.every((c) => c.city && typeof c.parcels === "number"), JSON.stringify(cities.body).slice(0, 200));
  const perf = await j("/analytics/delivery-performance", { token });
  check("analytics delivery performance", perf.status === 200 && perf.body.length === 6 && perf.body.every((m) => m.onTime >= 0 && m.onTime <= 100 && m.delayed + m.onTime === 100), JSON.stringify(perf.body).slice(0, 200));
}


// ---- international Fikisha layer ----
{
  const hubs = await j("/shop/hubs");
  check("shop hubs (public)", hubs.status === 200 && hubs.body?.hubs?.length === 7);
  const world = await j("/shop/world");
  check("shop world list (public)", world.status === 200 && world.body?.countries?.length > 40 && Array.isArray(world.body?.plans));
  const noauth = await j("/members");
  check("members list requires auth", noauth.status === 401);
  const members = await j("/members", { token });
  const m = members.body?.data?.[0];
  check("members enriched", members.status === 200 && Array.isArray(members.body?.data) && m && typeof m.totals?.parcels === "number" && m.hubAddresses?.[0]?.suite, JSON.stringify(m).slice(0, 180));
  const quote = await j("/parcels/calculate-cost", { fetch: { method: "POST", body: JSON.stringify({ shipmentType: "international", originCountry: "United States", destinationCountry: "Uganda", destinationCity: "Kampala", parcelCategory: "electronics", weight: 2, deliveryType: "standard" }) } });
  check("international quote in USD", quote.status === 200 && quote.body?.currency === "USD" && quote.body?.price >= 18, JSON.stringify(quote.body));
  const memberWithParcels = members.body?.data?.find((x) => x.totals?.parcels > 0);
  const filter = await j(`/parcels?member=${memberWithParcels?._id}&limit=5`, { token });
  check("parcels filter by member", filter.status === 200 && filter.body?.total > 0);
  const intl = await j("/parcels?limit=100", { token });
  const intlRow = intl.body?.data?.find((p) => p.shipmentType === "international");
  check("intl parcel has member/store/country fields", !!intlRow?.originCountry && !!intlRow?.destinationCountry && intlRow?.currency === "USD" && !!intlRow?.storeName && !!intlRow?.memberEmail);
  const stats = await j("/dashboard/stats", { token });
  check("stats include international totals", stats.status === 200 && stats.body?.totals?.international > 0 && stats.body?.totals?.revenue > 0);
}

console.log(`\n${failed === 0 ? "ALL SMOKE CHECKS PASSED" : failed + " CHECK(S) FAILED"}`);
process.exit(failed === 0 ? 0 : 1);