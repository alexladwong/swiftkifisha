import fs from "node:fs";
const base = "http://localhost:5001/api";
const j = async (p, o = {}) => {
  const res = await fetch(base + p, { headers: { "Content-Type": "application/json", ...(o.tok ? { Authorization: "Bearer " + o.tok } : {}) }, ...o.f });
  let b = null; try { b = await res.json(); } catch {}
  return { status: res.status, body: b };
};
const keys = (x, depth = 0) => {
  if (!x || typeof x !== "object") return typeof x;
  if (Array.isArray(x)) return x.length ? ["array<" + keys(x[0], depth + 1) + ">"] : ["array<empty>"];
  const out = {};
  for (const k of Object.keys(x).slice(0, 40)) {
    out[k] = depth < 2 ? keys(x[k], depth + 1) : typeof x[k];
  }
  return out;
};
const login = await j("/auth/login", { f: { method: "POST", body: JSON.stringify({ email: "admin@swiftship.com", password: "Admin@123" }) } });
const tok = login.body.token;
const snap = {};
snap.login = keys(login.body);
snap.health = keys((await j("/health")).body);
snap.quoteNational = keys((await j("/parcels/calculate-cost", { f: { method: "POST", body: JSON.stringify({ shipmentType: "national", originCity: "Kampala", destinationCity: "Jinja", parcelCategory: "document", weight: 1, deliveryType: "standard" }) } })).body);
snap.quoteInternational = keys((await j("/parcels/calculate-cost", { f: { method: "POST", body: JSON.stringify({ shipmentType: "international", originCountry: "United States", destinationCountry: "United Kingdom", destinationCity: "United Kingdom, London", parcelCategory: "electronics", weight: 2, deliveryType: "standard" }) } })).body);
const list = await j("/parcels?limit=1", { tok });
snap.parcelRow = keys(list.body.data[0]);
snap.parcelListMeta = keys(list.body);
const trackId = list.body.data[0].trackingId;
snap.tracked = keys((await j("/parcels/track/" + trackId)).body);
snap.stats = keys((await j("/dashboard/stats", { tok })).body);
const members = await j("/members?limit=1", { tok });
snap.memberRow = keys(members.body.data[0]);
snap.membersMeta = keys(members.body);
fs.writeFileSync("contract-sample.json", JSON.stringify(snap, null, 2));
console.log("captured", Object.keys(snap).length, "shapes -> backend/contract-sample.json");
