import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { createAuth } from "./betterAuth/auth";
import { calculatePrice } from "./lib/pricing";
import { HUB_COUNTRIES, UGANDA_CITIES } from "./lib/intl";
import { checkpointRecord } from "./parcels";

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const FIRST = ["Ahmed","Bilal","Fatima","Ayesha","Usman","Hira","Kamran","Zainab","Hamza","Nadia","Omar","Sana","Imran","Rabia","Mariam","Faisal","Sadia","Talha","Hina","Yasir","Areeba","Saad","Emily","Daniel","Sofia","Liam","Layla","Noah"];
const LAST = ["Khan","Ahmed","Malik","Sheikh","Raza","Qureshi","Hussain","Ali","Baig","Farooq","Siddiqui","Mirza","Nadeem","Abbasi","Noor","Shah","Tariq","Javed","Aslam","Smith","Brown","Haddad","Aziz","Rahman"];
const CATS = ["small_package","small_package","document","clothing","electronics","books","fragile","cosmetics","medicine"];
const HOME: Array<[string, string]> = [
  ["Uganda","Kampala"],["Uganda","Entebbe"],["Uganda","Jinja"],["United Arab Emirates","Dubai"],
  ["Saudi Arabia","Riyadh"],["United Kingdom","London"],["United States","Houston"],["Canada","Toronto"],
  ["Australia","Sydney"],["Germany","Frankfurt"],["Qatar","Doha"],["Singapore","Singapore"],
];
const STORES: Record<string, string[]> = {
  "United States": ["Amazon.com","eBay","Walmart","Nike.com","Etsy"],
  "United Kingdom": ["Amazon.co.uk","ASOS","Boots"],
  "United Arab Emirates": ["noon.com","Amazon.ae"],
  Germany: ["Amazon.de","Zalando"],
  China: ["AliExpress","Shein","Tmall"],
  Singapore: ["Shopee SG","Lazada SG"],
  "Hong Kong": ["HKTVmall","Lazada HK"],
};

const name_ = () => pick(FIRST) + " " + pick(LAST);

function slipCheckpoints(args: {
  parcel: any; flow: string; createdAtMs: number; now: number; arrivedAt: Date;
}) {
  const { parcel, flow, createdAtMs, now, arrivedAt } = args;
  const cps: Array<[string, number, string]> = [];
  if (flow === "in_transit") cps.push(["in_transit", 0.6, "Departed origin hub"]);
  if (flow === "out_for_delivery") { cps.push(["in_transit", 0.5, "In transit to destination"]); cps.push(["out_for_delivery", 0.9, "Out for delivery with courier rider"]); }
  if (flow === "delivered") {
    cps.push(["in_transit", 0.35, "Departed origin hub"]);
    cps.push(["in_transit", 0.65, "Arrived at destination gateway"]);
    cps.push(["out_for_delivery", 0.88, "Out for delivery with courier rider"]);
    cps.push(["delivered", 1, "Delivered to recipient"]);
  }
  const horizon = Math.min(now - 1800000, createdAtMs + (flow === "delivered" ? rand(3, 9) : Math.max(1, (now - createdAtMs) / 86400000) * 1.2) * 86400000);
  const span = Math.max(3600000, horizon - arrivedAt.getTime());
  const checkpoints = [checkpointRecord({
    status: "arrived", location: parcel.originCity, message: "Shipment received at origin facility", at: arrivedAt,
  })];
  let prev = arrivedAt.getTime();
  for (const [status, frac, message] of cps) {
    const at = new Date(Math.max(prev + 60000, arrivedAt.getTime() + span * frac));
    prev = at.getTime();
    checkpoints.push(checkpointRecord({ status, location: parcel.destinationCity, message, at }));
  }
  return checkpoints;
}

// Idempotent demo dataset: 2 admins, ~12 members, ~64 parcels. Reseed with force: true.
export const all = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("parcels").first();
    if (existing && !args.force) return { seeded: false, message: "Data already present; run with { force: true } to reseed." };
    if (args.force) {
      const [parcels, members] = await Promise.all([ctx.db.query("parcels").collect(), ctx.db.query("members").collect()]);
      for (const p of parcels) await ctx.db.delete(p._id);
      for (const m of members) await ctx.db.delete(m._id);
    }

    // Admins: Better Auth users + admins table marking dashboard access.
    const auth = createAuth(ctx);
    const adminSeeds = [
      { name: "SwiftUg Global Admin", email: "admin@swiftship.com", password: "Admin@123" },
      { name: "Operations Team", email: "ops@swiftship.com", password: "Ops@123" },
    ];
    for (const a of adminSeeds) {
      const existingAdmin = await ctx.db.query("admins").withIndex("by_email", (q: any) => q.eq("email", a.email)).first();
      if (!existingAdmin) {
        try {
          await auth.api.signUpEmail({ body: { name: a.name, email: a.email, password: a.password } });
        } catch (e: any) {
          console.log("seed admin signup skipped:", (e?.message ?? "").slice(0, 140));
        }
        await ctx.db.insert("admins", { email: a.email, name: a.name, createdAt: new Date().toISOString() });
      }
    }

    // Members
    const usedEmails = new Set<string>();
    let suiteCounter = 12000;
    for (let i = 0; i < 12; i += 1) {
      const [country, city] = pick(HOME);
      const nm = name_();
      const email = nm.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".") + "." + rand(1, 99) + "@example.com";
      if (usedEmails.has(email)) continue;
      usedEmails.add(email);
      const code = "SP-" + suiteCounter;
      suiteCounter += 1;
      const hubCount = i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1;
      const hubs = [...HUB_COUNTRIES].sort(() => Math.random() - 0.5).slice(0, hubCount);
      await ctx.db.insert("members", {
        name: nm, email, phone: "+256-700-123456",
        plan: pick(["Saver", "Classic", "Pro"]),
        homeCountry: country, homeCity: city,
        address: "House " + rand(1, 300) + ", " + city + ", " + country,
        memberCode: code,
        joinedAt: new Date(Date.now() - rand(20, 400) * 86400000).toISOString(),
        hubAddresses: hubs.map((h) => ({
          country: h.country, city: h.city,
          suite: code + "-" + h.code,
          addressLines: [h.city + " SwiftUg Mailroom", h.country],
        })),
      });
    }

    // Parcels: ~1 in 4 are member shop-and-ship orders.
    const allMembers: any[] = (await ctx.db.query("members").collect()) as any[];
    const now = Date.now();
    for (let i = 0; i < 64; i += 1) {
      const createdAtMs = now - rand(0, 175) * 86400000 - rand(0, 86399999);
      const ageDays = (now - createdAtMs) / 86400000;
      const deliveryType = Math.random() < 0.8 ? "standard" : "overnight";
      const category = pick(CATS);
      const weight = category === "document" ? 0.5 : Math.round((rand(1, 120) / 10) * 10) / 10;
      const member: any = i % 4 === 0 ? pick(allMembers) : null;
      let fields: any = {};
      let originCity: string;
      let destinationCity: string;
      let originCountry: string;
      let destinationCountry: string;
      if (member) {
        const hub = pick(HUB_COUNTRIES);
        originCountry = hub.country;
        destinationCountry = member.homeCountry;
        destinationCity = member.homeCity;
        originCity = hub.city + ", " + hub.country;
        const store = pick(STORES[hub.country] ?? ["SwiftUg Mailroom"]);
        const { price, currency } = calculatePrice({ shipmentType: "international", parcelCategory: category, weight, deliveryType, originCountry, destinationCountry });
        fields = {
          senderName: store, senderPhone: "+1-800-555-0134", senderAddress: hub.city + ", " + hub.country,
          receiverName: member.name, receiverPhone: member.phone, receiverAddress: member.address,
          shipmentType: "international",
          storeName: store, memberId: member._id, memberEmail: member.email,
          price, currency,
        };
      } else {
        originCity = pick(UGANDA_CITIES);
        destinationCity = pick(UGANDA_CITIES.filter((c) => c !== originCity));
        originCountry = "Uganda";
        destinationCountry = "Uganda";
        const { price, currency } = calculatePrice({ shipmentType: "national", parcelCategory: category, weight, deliveryType });
        fields = {
          senderName: name_(), senderPhone: "+256-701-765432", senderAddress: "House 1, " + originCity,
          receiverName: name_(), receiverPhone: "+256-702-111222", receiverAddress: "House 2, " + destinationCity,
          shipmentType: "national", price, currency,
        };
      }
      const flow = ageDays > 9 && Math.random() < 0.8 ? "delivered" : ageDays > 5 ? "out_for_delivery" : ageDays > 2 ? "in_transit" : "arrived";
      const arrivedAt = new Date(createdAtMs + rand(30, 240) * 60000);
      const parcelShell = { originCity, destinationCity } as any;
      const checkpoints = slipCheckpoints({ parcel: parcelShell, flow, createdAtMs, now, arrivedAt });
      const status = flow === "arrived" ? "arrived" : flow;
      const tracking = "UG-" + ["CRR","SWP","SPD","XPR"][i % 4] + "-" + String(100000 + Math.floor(Math.random() * 899999));
      await ctx.db.insert("parcels", {
        ...fields,
        trackingId: tracking,
        originCity, destinationCity, originCountry, destinationCountry,
        deliveryType, parcelCategory: category, weight,
        status,
        createdAt: new Date(createdAtMs).toISOString(),
        updatedAt: checkpoints[checkpoints.length - 1].timestamp,
        checkpoints,
      });
    }
    const finalParcels = await ctx.db.query("parcels").collect();
    const finalMembers = await ctx.db.query("members").collect();
    return { seeded: true, admins: adminSeeds.length, members: finalMembers.length, parcels: finalParcels.length };
  },
});