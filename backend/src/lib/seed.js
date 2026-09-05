import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { db, objectId, generateTrackingId } from "./db.js";
import { calculatePrice, deliveryTargetDays } from "./pricing.js";
import {
  UGANDA_CITIES,
  areaForCity,
  INTERNATIONAL_DESTINATION_OPTIONS,
} from "./referenceData.js";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES, MEMBER_PLANS } from "./intl.js";
import { formatDateTime } from "./util.js";

const FIRST_NAMES = [
  "Ahmed", "Bilal", "Fatima", "Ayesha", "Usman", "Muhammad", "Hira", "Kamran",
  "Zainab", "Hamza", "Nadia", "Omar", "Sana", "Imran", "Rabia", "Adnan",
  "Mariam", "Faisal", "Sadia", "Talha", "Hina", "Yasir", "Areeba", "Saad",
  "Khadija", "Shahzaib", "Amna", "Junaid", "Mehwish", "Zubair",
  "Emily", "Daniel", "Sofia", "Liam", "Yusuf", "Layla", "Omar", "Aisha",
  "Noah", "Mia",
];
const LAST_NAMES = [
  "Khan", "Ahmed", "Malik", "Sheikh", "Raza", "Qureshi", "Hussain", "Ali",
  "Baig", "Farooq", "Siddiqui", "Mehmood", "Mirza", "Nadeem", "Abbasi",
  "Noor", "Shah", "Tariq", "Javed", "Aslam", "Akhtar", "Rehman", "Chaudhry",
  "Iqbal", "Bukhari", "Zaidi", "Ansari", "Hashmi", "Smith", "Brown",
  "Wilson", "Khan", "Haddad", "Aziz", "Rahman",
];
const MOBILE_PREFIXES = ["300", "301", "302", "303", "304", "305", "306", "321", "322", "323", "333", "334", "335", "345", "346"];
const CATEGORY_BAG = [
  "small_package", "small_package", "small_package", "document", "document",
  "clothing", "clothing", "electronics", "books", "fragile", "cosmetics",
  "medicine", "food", "large_package",
];
const DELIVERY_BAG = ["standard", "standard", "standard", "overnight", "overnight", "sameDay"];
const INTL_DELIVERY_BAG = ["standard", "standard", "standard", "standard", "overnight"];

/** Member home locations: Uganda plus an international diaspora. */
const MEMBER_HOMES = [
  { country: "Uganda", cities: UGANDA_CITIES },
  { country: "United Arab Emirates", cities: ["Dubai", "Abu Dhabi", "Sharjah"] },
  { country: "Saudi Arabia", cities: ["Riyadh", "Jeddah", "Dammam"] },
  { country: "United Kingdom", cities: ["London", "Birmingham", "Manchester", "Leeds"] },
  { country: "United States", cities: ["New York", "Houston", "Chicago", "Dallas", "San Jose"] },
  { country: "Canada", cities: ["Toronto", "Mississauga", "Calgary"] },
  { country: "Australia", cities: ["Sydney", "Melbourne", "Brisbane"] },
  { country: "Germany", cities: ["Berlin", "Frankfurt", "Hamburg"] },
  { country: "France", cities: ["Paris", "Lyon"] },
  { country: "Qatar", cities: ["Doha"] },
  { country: "Kuwait", cities: ["Kuwait City"] },
  { country: "Malaysia", cities: ["Kuala Lumpur"] },
  { country: "Singapore", cities: ["Singapore"] },
  { country: "Bahrain", cities: ["Manama"] },
];

const STORE_BY_HUB = {
  "United States": ["Amazon.com", "eBay", "Walmart", "Nike.com", "Etsy", "Target", "Apple Store", "Best Buy"],
  "United Kingdom": ["Amazon.co.uk", "ASOS", "John Lewis", "Boots", "Argos", "Zara UK"],
  "United Arab Emirates": ["noon.com", "Amazon.ae", "Namshi", "Carrefour UAE"],
  Germany: ["Amazon.de", "Zalando", "Otto", "MediaMarkt"],
  China: ["AliExpress", "Shein", "Tmall", "JD.com", "Taobao"],
  Singapore: ["Shopee SG", "Lazada SG", "FairPrice"],
  "Hong Kong": ["HKTVmall", "Lazada HK", "Fortress"],
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const randomPhone = () => `+256-7${rand(0, 9)}${rand(10000000, 99999999)}`;
const randomEmail = (name) => `${name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}.${rand(1, 999)}@example.com`;

const randWeightForCategory = (category) => {
  if (category === "document") return Math.max(0.1, Math.round(rand(2, 20) / 10) / 10);
  if (category === "small_package" || category === "books") return rand(3, 45) / 10;
  if (category === "large_package") return rand(5, 200) / 10;
  return rand(2, 90) / 10;
};

const addressForCity = (city) => `House ${rand(1, 320)}, Street ${rand(1, 14)}, ${pick(areaForCity(city))}, ${city}`;
const addressForCityCountry = (city, country) =>
  `House ${rand(1, 320)}, Street ${rand(1, 14)}, ${city}, ${country}`;

function makeCheckpoint({ status, at, location, message }) {
  const iso = at.toISOString();
  return { status, location, message, timestamp: iso, timestamps: iso, dateTime: formatDateTime(at) };
}

function domesticCheckpoints(p) {
  const base = [
    makeCheckpoint({ status: "arrived", at: p.arrivedAt, location: p.originCity, message: "Shipment received at origin facility" }),
  ];
  const cps = [...base];
  if (p.flow !== "arrived") {
    cps.push(makeCheckpoint({ status: "in_transit", at: p.steps[0], location: p.originCity, message: `Departed ${p.originCity} hub` }));
  }
  if (p.flow === "in_transit2" || p.flow === "out_for_delivery" || p.flow === "delivered") {
    cps.push(makeCheckpoint({ status: "in_transit", at: p.steps[1], location: p.destinationCity, message: `Arrived at ${p.destinationCity} sorting facility` }));
  }
  if (p.flow === "out_for_delivery" || p.flow === "delivered") {
    cps.push(makeCheckpoint({ status: "out_for_delivery", at: p.steps[2], location: p.destinationCity, message: "Out for delivery with courier rider" }));
  }
  if (p.flow === "delivered") {
    cps.push(makeCheckpoint({ status: "delivered", at: p.deliveredAt, location: p.destinationCity, message: `Delivered to ${p.receiverName}` }));
  }
  return cps;
}

function inboundCheckpoints(p) {
  const hubCity = HUB_COUNTRIES.find((h) => h.country === p.originCountry)?.city || p.originCountry;
  const cps = [
    makeCheckpoint({ status: "arrived", at: p.arrivedAt, location: `${hubCity}, ${p.originCountry}`, message: `Order received at your ${p.originCountry} mailbox` }),
  ];
  if (p.flow !== "arrived") {
    cps.push(makeCheckpoint({ status: "in_transit", at: p.steps[0], location: `${hubCity}, ${p.originCountry}`, message: "Package consolidated and dispatched for international shipping" }));
  }
  if (p.flow === "in_transit2" || p.flow === "out_for_delivery" || p.flow === "delivered") {
    cps.push(makeCheckpoint({ status: "in_transit", at: p.steps[1], location: `${p.destinationCountry}`, message: "Customs clearance completed in destination country" }));
  }
  if (p.flow === "out_for_delivery" || p.flow === "delivered") {
    cps.push(makeCheckpoint({ status: "out_for_delivery", at: p.steps[2], location: p.destinationCity, message: "Out for local delivery" }));
  }
  if (p.flow === "delivered") {
    cps.push(makeCheckpoint({ status: "delivered", at: p.deliveredAt, location: p.destinationCity, message: `Delivered to member ${p.receiverName}` }));
  }
  return cps;
}

/** Shared "how far along is this parcel" assignment. */
function planFlow(ageDays, createdAtMs, now) {
  const deliverChance = ageDays > 12 ? 0.9 : ageDays > 6 ? 0.68 : ageDays > 3 ? 0.3 : 0.08;
  const isDelivered = Math.random() < deliverChance;
  const arrivedAt = new Date(createdAtMs + rand(30, 240) * 60000);
  const baseFlow = ageDays > 7 ? "out_for_delivery" : ageDays > 3 ? "in_transit2" : ageDays > 1 ? "in_transit" : "arrived";
  const flow = isDelivered ? "delivered" : baseFlow;
  const horizon = Math.max(now - 3600000, arrivedAt.getTime() + 6 * 3600000);
  const fractions = { in_transit: [0.6], in_transit2: [0.45, 0.85], out_for_delivery: [0.4, 0.75, 0.92], delivered: [0.3, 0.6, 0.82] };
  const steps = (fractions[flow] || []).map((f) => new Date(arrivedAt.getTime() + (horizon - arrivedAt.getTime()) * f));
  return { isDelivered, arrivedAt, flow, steps };
}

/** If delivered, pin the timeline so every checkpoint precedes delivery. */
function adjustDelivered(plan, deliveredAt, now) {
  if (!plan.isDelivered || !deliveredAt) return deliveredAt;
  let d = deliveredAt.getTime();
  const a = plan.arrivedAt.getTime();
  if (d < a + 3600000) d = Math.min(now - 1800000, a + 3600000);
  const span = d - a;
  plan.flow = "delivered";
  plan.steps = [0.3, 0.6, 0.82].map((f) => new Date(a + span * f));
  return new Date(d);
}

function deliveredAtFor({ createdAtMs, targetDays, isDelivered, now }) {
  if (!isDelivered) return null;
  const days = Math.random() < 0.78
    ? targetDays * (0.55 + Math.random() * 0.45)
    : targetDays * 1.1 + Math.random() * Math.max(2, targetDays) * 0.9;
  const floorMs = createdAtMs + 2 * 3600000;
  const latest = now - rand(3600000, 43200000);
  return new Date(Math.max(floorMs, Math.min(createdAtMs + days * 86400000, latest)));
}

function buildParcelBase({ createdAtMs, now, flow, steps, arrivedAt, deliveredAt, senderName, senderPhone, senderAddress, receiverName, receiverPhone, receiverAddress, shipmentType, originCity, destinationCity, originCountry, destinationCountry, deliveryType, parcelCategory, weight, storeName = null, memberId = null, memberEmail = null }) {
  const { price, currency } = calculatePrice({
    shipmentType, parcelCategory, weight, deliveryType,
    originCountry: originCountry || "Uganda", destinationCountry: destinationCountry || "Uganda",
  });
  const createdAt = new Date(createdAtMs);
  const parcel = {
    _id: objectId(),
    trackingId: null,
    senderName, senderPhone, senderAddress,
    receiverName, receiverPhone, receiverAddress,
    shipmentType,
    originCity, destinationCity,
    originCountry: originCountry || "Uganda",
    destinationCountry: destinationCountry || "Uganda",
    deliveryType, parcelCategory, weight,
    price, currency,
    storeName, memberId, memberEmail,
    createdAt: createdAt.toISOString(),
    updatedAt: null,
    checkpoints: [],
  };
  const checkpoints = shipmentType === "international"
    ? inboundCheckpoints({ ...parcel, flow, steps, arrivedAt, deliveredAt })
    : domesticCheckpoints({ ...parcel, flow, steps, arrivedAt, deliveredAt });
  parcel.checkpoints = checkpoints;
  parcel.updatedAt = checkpoints[checkpoints.length - 1].timestamp;
  return parcel;
}

export async function buildDemoData() {
  const users = [];
  for (const admin of [
    { name: "SwiftPak Global Admin", email: "admin@swiftship.com", password: "Admin@123" },
    { name: "Operations Team", email: "ops@swiftship.com", password: "Ops@123" },
  ]) {
    users.push({
      _id: objectId(),
      name: admin.name,
      email: admin.email.toLowerCase(),
      passwordHash: await bcrypt.hash(admin.password, config.bcryptRounds ?? 10),
      role: "admin",
      createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
    });
  }

  // ---- Members with virtual mailbox addresses in multiple hub countries ----
  const members = [];
  const memberEmails = new Set();
  let suiteCounter = 11000;
  for (let i = 0; i < 26; i += 1) {
    const home = pick(MEMBER_HOMES);
    const homeCity = pick(home.cities);
    const name = randomName();
    const email = randomEmail(name);
    if (memberEmails.has(email)) continue;
    memberEmails.add(email);
    const hubCount = Math.random() < 0.25 ? 3 : Math.random() < 0.6 ? 2 : 1;
    const hubs = [...HUB_COUNTRIES].sort(() => Math.random() - 0.5).slice(0, hubCount);
    const code = `SP-${suiteCounter}`;
    suiteCounter += 1;
    members.push({
      _id: objectId(),
      name,
      email,
      phone: randomPhone(),
      plan: pick(MEMBER_PLANS),
      homeCountry: home.country,
      homeCity,
      address: home.country === "Uganda" ? addressForCity(homeCity) : addressForCityCountry(homeCity, home.country),
      memberCode: code,
      joinedAt: new Date(Date.now() - rand(10, 400) * 86400000).toISOString(),
      hubAddresses: hubs.map((h) => ({
        country: h.country,
        city: h.city,
        suite: `${code}-${h.code}`,
        addressLines: HUB_MAILBOX_EXAMPLES[h.country] || [],
      })),
    });
  }

  // ---- Parcels: domestic shipments + international shop-and-ship arrivals ----
  const parcels = [];
  const now = Date.now();
  const parcelCount = 200;

  for (let i = 0; i < parcelCount; i += 1) {
    const createdAtMs = now - rand(0, 175) * 86400000 - rand(0, 86399999);
    const ageDays = (now - createdAtMs) / 86400000;
    const isMemberShipment = i % 9 !== 0 && i % 4 === 0; // ~1 in 4 are international member orders
    const member = isMemberShipment ? pick(members) : null;
    const deliveryType = pick(member ? INTL_DELIVERY_BAG : DELIVERY_BAG);
    const parcelCategory = pick(CATEGORY_BAG);
    const weight = randWeightForCategory(parcelCategory);

    let parcel;
    if (!member) {
      const shipmentType = "national";
      const originCity = pick(UGANDA_CITIES);
      const destinationCity = pick(UGANDA_CITIES.filter((c) => c !== originCity));
      const senderName = randomName();
      const receiverName = randomName();
      const plan = planFlow(ageDays, createdAtMs, now);
      const targetDays = deliveryTargetDays({ shipmentType, deliveryType });
      const deliveredAt = adjustDelivered(plan, deliveredAtFor({ createdAtMs, targetDays, isDelivered: plan.isDelivered, now }), now);
      parcel = buildParcelBase({
        createdAtMs, now, flow: plan.flow, steps: plan.steps, arrivedAt: plan.arrivedAt, deliveredAt,
        senderName,
        senderPhone: randomPhone(),
        senderAddress: addressForCity(originCity),
        receiverName,
        receiverPhone: randomPhone(),
        receiverAddress: addressForCity(destinationCity),
        shipmentType, originCity, destinationCity,
        originCountry: "Uganda", destinationCountry: "Uganda",
        deliveryType, parcelCategory, weight,
      });
    } else {
      const originHub = pick(HUB_COUNTRIES);
      const shipmentType = "international";
      const storeName = pick(STORE_BY_HUB[originHub.country]);
      const suite = member.hubAddresses.find((a) => a.country === originHub.country);
      const destinationCity = member.homeCity;
      const plan = planFlow(ageDays, createdAtMs, now);
      const targetDays = deliveryTargetDays({ shipmentType, deliveryType });
      const deliveredAt = adjustDelivered(plan, deliveredAtFor({ createdAtMs, targetDays, isDelivered: plan.isDelivered, now }), now);
      parcel = buildParcelBase({
        createdAtMs, now, flow: plan.flow, steps: plan.steps, arrivedAt: plan.arrivedAt, deliveredAt,
        senderName: storeName,
        senderPhone: randomPhone(),
        senderAddress: suite ? `${suite.addressLines.join(", ")}, ${originHub.country}` : `${originHub.city}, ${originHub.country}`,
        receiverName: member.name,
        receiverPhone: member.phone,
        receiverAddress: member.address,
        shipmentType,
        originCity: `${originHub.city}, ${originHub.country}`,
        destinationCity,
        originCountry: originHub.country,
        destinationCountry: member.homeCountry,
        deliveryType, parcelCategory, weight,
        storeName,
        memberId: member._id,
        memberEmail: member.email,
      });
    }
    parcels.push(parcel);
  }

  // Unique tracking ids
  const usedIds = new Set();
  for (const p of parcels) {
    p.trackingId = generateTrackingId([...usedIds].map((id) => ({ trackingId: id })));
    usedIds.add(p.trackingId);
  }
  parcels.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { users, members, parcels };
}

/**
 * Seeds the demo dataset once when the database is empty (first boot).
 * Returns true when seeding happened.
 */
export async function seedIfEmpty() {
  if (!config.seedOnStart || !db.isEmpty()) return false;
  const { users, members, parcels } = await buildDemoData();
  db.data = { users, members, parcels };
  db.persist();
  console.log(`[seed] Database seeded: ${users.length} admins, ${members.length} members, ${parcels.length} parcels (data/db.json)`);
  return true;
}