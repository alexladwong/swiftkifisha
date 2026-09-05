/**
 * SwiftUg Global — international Fikisha reference data.
 * Mirrors backend/src/lib/intl.js so the public site can render hubs, served
 * countries and fee hints without a network round-trip.
 */

export const SHOP_HUBS = [
  {
    id: "US", country: "United States", city: "New York", flag: "🇺🇸", currency: "USD",
    pickupFee: 15,
    sample: { name: "SwiftUg Mailroom", lines: ["101 Fifth Avenue, Suite SP-100", "New York, NY 10003, USA"] },
    perks: ["Shop thousands of US online stores", "Free 30-day storage & consolidation", "Repackaging and photo inspection on request"],
    stores: ["Amazon.com", "eBay", "Walmart", "Nike.com", "Etsy", "Target", "Apple Store"],
  },
  {
    id: "GB", country: "United Kingdom", city: "London", flag: "🇬🇧", currency: "GBP",
    pickupFee: 15,
    sample: { name: "SwiftUg Mailroom UK", lines: ["Unit 7 SwiftUg House, 48 Farringdon Road", "London EC1M 3DG, United Kingdom"] },
    perks: ["High-street and online favourites", "European redistribution hub", "VAT-exempt mailbox handling"],
    stores: ["Amazon.co.uk", "ASOS", "John Lewis", "Boots", "Argos"],
  },
  {
    id: "AE", country: "United Arab Emirates", city: "Dubai", flag: "🇦🇪", currency: "AED",
    pickupFee: 12,
    sample: { name: "SwiftUg Kampala", lines: ["Office 204, Building 12, Business Bay", "Dubai, United Arab Emirates"] },
    perks: ["Gateway to the Middle East", "noon, Amazon.ae and more", "Fast Gulf delivery lanes"],
    stores: ["noon.com", "Amazon.ae", "Namshi", "Carrefour UAE"],
  },
  {
    id: "DE", country: "Germany", city: "Frankfurt", flag: "🇩🇪", currency: "EUR",
    pickupFee: 16,
    sample: { name: "SwiftUg Mailroom DE", lines: ["SwiftUg Logistics GmbH, Frachtweg 9", "60327 Frankfurt am Main, Germany"] },
    perks: ["European e-commerce hub", "Zalando, Amazon.de, Otto", "Road & rail links across the EU"],
    stores: ["Amazon.de", "Zalando", "Otto", "MediaMarkt"],
  },
  {
    id: "CN", country: "China", city: "Shanghai", flag: "🇨🇳", currency: "CNY",
    pickupFee: 14,
    sample: { name: "SwiftUg Mailroom CN", lines: ["Room 2101, Tower B, 88 Century Avenue, Pudong", "Shanghai 200120, China"] },
    perks: ["Factory-direct deals", "AliExpress, Tmall, Shein and more", "E-commerce consolidation experts"],
    stores: ["AliExpress", "Shein", "Tmall", "JD.com", "Taobao"],
  },
  {
    id: "SG", country: "Singapore", city: "Singapore", flag: "🇸🇬", currency: "SGD",
    pickupFee: 13,
    sample: { name: "SwiftUg Mailroom SG", lines: ["28 Tuas Avenue 6, #03-11 SwiftUg Hub", "Singapore 639318"] },
    perks: ["Clean, fast Southeast Asia hub", "Shopee, Lazada and more", "Regional redistribution"],
    stores: ["Shopee SG", "Lazada SG", "FairPrice"],
  },
  {
    id: "HK", country: "Hong Kong", city: "Hong Kong", flag: "🇭🇰", currency: "HKD",
    pickupFee: 13,
    sample: { name: "SwiftUg Mailroom HK", lines: ["Unit 806, 8/F, Harbour View Centre, 120 Texaco Road", "Tsuen Wan, Hong Kong"] },
    perks: ["Duty-free shopping hub", "HKTVmall, Lazada HK and more", "Same-week Asia delivery"],
    stores: ["HKTVmall", "Lazada HK", "Fortress"],
  },
];

export const SHOP_HUB_OPTIONS = SHOP_HUBS.map((h) => ({ value: h.country, label: h.country, city: h.city, flag: h.flag }));

export const WORLD_COUNTRIES = [
  "Afghanistan","Australia","Austria","Bahrain","Bangladesh","Belgium","Brazil","Canada","China","Denmark","Egypt",
  "Finland","France","Germany","Greece","Hong Kong","India","Indonesia","Iran","Iraq","Ireland","Italy","Japan",
  "Jordan","Kenya","Kuwait","Lebanon","Malaysia","Maldives","Netherlands","New Zealand","Nigeria","Norway","Oman",
  "Uganda","Philippines","Poland","Qatar","Romania","Russia","Saudi Arabia","Singapore","South Africa","South Korea",
  "Spain","Sri Lanka","Sweden","Switzerland","Turkey","United Arab Emirates","United Kingdom","United States",
];

export const WORLD_DESTINATION_OPTIONS = [
  ["Afghanistan","Kabul"],["Australia","Canberra"],["Austria","Vienna"],["Bahrain","Manama"],["Bangladesh","Dhaka"],
  ["Belgium","Brussels"],["Brazil","Brasilia"],["Canada","Ottawa"],["China","Beijing"],["Denmark","Copenhagen"],
  ["Egypt","Cairo"],["Finland","Helsinki"],["France","Paris"],["Germany","Berlin"],["Greece","Athens"],
  ["Hong Kong","Hong Kong"],["India","New Delhi"],["Indonesia","Jakarta"],["Iran","Tehran"],["Iraq","Baghdad"],
  ["Ireland","Dublin"],["Italy","Rome"],["Japan","Tokyo"],["Jordan","Amman"],["Kenya","Nairobi"],
  ["Kuwait","Kuwait City"],["Lebanon","Beirut"],["Malaysia","Kuala Lumpur"],["Maldives","Malé"],
  ["Netherlands","Amsterdam"],["New Zealand","Wellington"],["Nigeria","Lagos"],["Norway","Oslo"],["Oman","Muscat"],
  ["Uganda","Kampala"],["Philippines","Manila"],["Poland","Warsaw"],["Qatar","Doha"],["Romania","Bucharest"],
  ["Russia","Moscow"],["Saudi Arabia","Riyadh"],["Singapore","Singapore"],["South Africa","Cape Town"],
  ["South Korea","Seoul"],["Spain","Madrid"],["Sri Lanka","Colombo"],["Sweden","Stockholm"],["Switzerland","Bern"],
  ["Turkey","Ankara"],["United Arab Emirates","Abu Dhabi"],["United Kingdom","London"],["United States","Washington, D.C."],
].map(([country, capital]) => ({ value: `${country}, ${capital}`, label: `${country}, ${capital}`, country, capital }));

// Uganda domestic places grouped by administrative region.
export const UGANDA_REGION_GROUPS = [
  { label: "Central Region", cities: ["Kampala", "Entebbe", "Mukono", "Nansana", "Kira", "Masaka"] },
  { label: "Eastern Region", cities: ["Jinja", "Mbale", "Soroti"] },
  { label: "Northern Region", cities: ["Gulu", "Lira", "Arua"] },
  { label: "Western Region", cities: ["Mbarara", "Kasese", "Fort Portal"] },
];

// Destination places (cities / states / regions) offered per country. Countries
// without a curated list fall back to their capital (see DESTINATION_PLACES_OF).
export const DESTINATION_PLACES = {
  "United States": ["New York", "California", "Texas", "Florida", "Illinois", "Washington"],
  "United Kingdom": ["London", "England", "Scotland", "Wales", "Northern Ireland"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  Germany: ["Berlin", "Frankfurt", "Munich", "Hamburg"],
  China: ["Shanghai", "Beijing", "Shenzhen", "Guangzhou"],
  Singapore: ["Singapore"],
  "Hong Kong": ["Hong Kong"],
  Kenya: ["Nairobi", "Mombasa"],
  Canada: ["Toronto", "Vancouver", "Calgary"],
  Australia: ["Sydney", "Melbourne", "Brisbane"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
  Qatar: ["Doha"],
  India: ["New Delhi", "Mumbai", "Bangalore"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban"],
  Uganda: ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Mbale", "Mukono", "Masaka", "Lira", "Kasese", "Fort Portal", "Arua", "Soroti", "Nansana", "Kira"],
};

export function placesForCountry(country) {
  if (DESTINATION_PLACES[country]) return DESTINATION_PLACES[country];
  const entry = WORLD_DESTINATION_OPTIONS.find((o) => o.country === country);
  return entry ? [entry.capital] : [];
}


export const MEMBER_PLANS = [
  { id: "Saver", blurb: "One international address to start", perks: ["1 hub mailbox", "Pay-as-you-ship fees", "Email support"] },
  { id: "Classic", blurb: "Most popular for regular shoppers", perks: ["3 hub mailboxes", "5% off shipping", "Free consolidation", "Priority support"] },
  { id: "Pro", blurb: "For serious cross-border buyers", perks: ["All 7 hub mailboxes", "10% off shipping", "Unlimited consolidation", "Dedicated shopper concierge"] },
];

export const moneySymbol = (currency) => (currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "UGX ");

export const formatMoney = (amount, currency = "USD") =>
  currency === "UGX"
    ? `UGX ${Number(amount || 0).toLocaleString()}`
    : `${moneySymbol(currency)}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;