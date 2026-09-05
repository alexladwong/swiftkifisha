import { query } from "./_generated/server";
import { HUB_COUNTRIES, HUB_MAILBOX_EXAMPLES, WORLD_WITH_CAPITALS } from "./lib/intl";

const HUB_PERKS: Record<string, string[]> = {
  "United States": ["Shop thousands of US online stores", "Free 30-day consolidation", "Repackaging and photo on request"],
  "United Kingdom": ["High-street and online favourites", "VAT-exempt mailbox handling", "Ship to Europe within days"],
  "United Arab Emirates": ["Gateway to the Middle East", "noon, Amazon.ae and more", "Fast Gulf delivery lanes"],
  Germany: ["European e-commerce hub", "Zalando, Amazon.de, Otto", "Road and rail links across the EU"],
  China: ["Factory-direct deals", "AliExpress, Tmall, Shein and more", "E-commerce consolidation experts"],
  Singapore: ["Clean, fast Southeast Asia hub", "Shopee, Lazada and more", "Regional redistribution"],
  "Hong Kong": ["Duty-free shopping hub", "HKTVmall, Lazada HK and more", "Same-week Asia delivery"],
};

export const hubs = query({
  args: {},
  handler: () => ({
    hubs: HUB_COUNTRIES.map((h) => ({
      id: h.code, country: h.country, city: h.city, pickupFee: h.pickupFee,
      addressLines: HUB_MAILBOX_EXAMPLES[h.country] ?? [],
      perks: HUB_PERKS[h.country] ?? [],
    })),
  }),
});

export const world = query({
  args: {},
  handler: () => ({
    countries: WORLD_WITH_CAPITALS.map(([country, capital]) => ({ country, capital, value: country + ", " + capital })),
    plans: ["Saver", "Classic", "Pro"],
  }),
});