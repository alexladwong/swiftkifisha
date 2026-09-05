/**
 * International shop-and-ship reference data (SwiftPak Global).
 * Members hold virtual mailbox addresses in "hub" countries; we receive their
 * online orders there and ship worldwide. Domestic service within Uganda
 * is UGX; every international shipment is quoted in USD.
 */
export const FX_UGX_PER_USD = 3700;

export const HUB_COUNTRIES = [
  { country: "United States", code: "US", city: "New York", currency: "USD", pickupFee: 15 },
  { country: "United Kingdom", code: "GB", city: "London", currency: "GBP", pickupFee: 15 },
  { country: "United Arab Emirates", code: "AE", city: "Dubai", currency: "AED", pickupFee: 12 },
  { country: "Germany", code: "DE", city: "Frankfurt", currency: "EUR", pickupFee: 16 },
  { country: "China", code: "CN", city: "Shanghai", currency: "CNY", pickupFee: 14 },
  { country: "Singapore", code: "SG", city: "Singapore", currency: "SGD", pickupFee: 13 },
  { country: "Hong Kong", code: "HK", city: "Hong Kong", currency: "HKD", pickupFee: 13 },
];
export const HUB_COUNTRY_NAMES = HUB_COUNTRIES.map((h) => h.country);

/** Extended worldwide destination list for member deliveries (country + capital). */
export const WORLD_COUNTRIES = [
  "Afghanistan", "Australia", "Austria", "Bahrain", "Bangladesh", "Belgium",
  "Brazil", "Canada", "China", "Denmark", "Egypt", "Finland", "France",
  "Germany", "Greece", "Hong Kong", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Italy", "Japan", "Jordan", "Kenya", "Kuwait", "Lebanon",
  "Malaysia", "Maldives", "Netherlands", "New Zealand", "Nigeria", "Norway",
  "Oman", "Uganda", "Philippines", "Poland", "Qatar", "Romania", "Russia",
  "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
  "Sri Lanka", "Sweden", "Switzerland", "Turkey", "United Arab Emirates",
  "United Kingdom", "United States",
];
export const WORLD_COUNTRIES_WITH_CAPITALS = [
  ["Afghanistan", "Kabul"], ["Australia", "Canberra"], ["Austria", "Vienna"],
  ["Bahrain", "Manama"], ["Bangladesh", "Dhaka"], ["Belgium", "Brussels"],
  ["Brazil", "Brasilia"], ["Canada", "Ottawa"], ["China", "Beijing"],
  ["Denmark", "Copenhagen"], ["Egypt", "Cairo"], ["Finland", "Helsinki"],
  ["France", "Paris"], ["Germany", "Berlin"], ["Greece", "Athens"],
  ["Hong Kong", "Hong Kong"], ["India", "New Delhi"], ["Indonesia", "Jakarta"],
  ["Iran", "Tehran"], ["Iraq", "Baghdad"], ["Ireland", "Dublin"],
  ["Italy", "Rome"], ["Japan", "Tokyo"], ["Jordan", "Amman"],
  ["Kenya", "Nairobi"], ["Kuwait", "Kuwait City"], ["Lebanon", "Beirut"],
  ["Malaysia", "Kuala Lumpur"], ["Maldives", "Malé"], ["Netherlands", "Amsterdam"],
  ["New Zealand", "Wellington"], ["Nigeria", "Lagos"], ["Norway", "Oslo"],
  ["Oman", "Muscat"], ["Uganda", "Kampala"], ["Philippines", "Manila"],
  ["Poland", "Warsaw"], ["Qatar", "Doha"], ["Romania", "Bucharest"],
  ["Russia", "Moscow"], ["Saudi Arabia", "Riyadh"], ["Singapore", "Singapore"],
  ["South Africa", "Cape Town"], ["South Korea", "Seoul"], ["Spain", "Madrid"],
  ["Sri Lanka", "Colombo"], ["Sweden", "Stockholm"], ["Switzerland", "Bern"],
  ["Turkey", "Ankara"], ["United Arab Emirates", "Abu Dhabi"],
  ["United Kingdom", "London"], ["United States", "Washington, D.C."],
].map(([country, capital]) => ({ country, capital, value: `${country}, ${capital}` }));

/** Destination-zone -> USD per kg (pickup fee handled via origin hub table). */
const ZONES = [
  { name: "Zone 1", countries: ["Afghanistan", "India", "Iran", "Uganda", "Bahrain", "Iraq", "Jordan", "Kuwait", "Lebanon", "Oman", "Qatar", "Saudi Arabia", "Turkey", "United Arab Emirates", "Egypt"], perKg: 7 },
  { name: "Zone 2", countries: ["Australia", "Bangladesh", "China", "Hong Kong", "Indonesia", "Japan", "Malaysia", "Maldives", "New Zealand", "Philippines", "Singapore", "South Korea", "Sri Lanka", "Thailand"], perKg: 8.5 },
  { name: "Zone 3", countries: ["Austria", "Belgium", "Denmark", "Finland", "France", "Germany", "Greece", "Ireland", "Italy", "Netherlands", "Norway", "Poland", "Romania", "Russia", "Spain", "Sweden", "Switzerland", "United Kingdom"], perKg: 9.5 },
  { name: "Zone 4", countries: ["Brazil", "Canada", "Kenya", "Nigeria", "South Africa", "United States"], perKg: 11 },
];

export function zoneForCountry(country) {
  const zone = ZONES.find((z) => z.countries.includes(country));
  return zone || ZONES[ZONES.length - 1];
}

export const MEMBER_PLANS = ["Saver", "Classic", "Pro"];

/** Colourful example mailboxes per hub — shown on the public hub page. */
export const HUB_MAILBOX_EXAMPLES = {
  "United States": ["101 Fifth Avenue, Suite SP-100", "New York, NY 10003, USA"],
  "United Kingdom": ["Unit 7 SwiftPak House, 48 Farringdon Road", "London EC1M 3DG, United Kingdom"],
  "United Arab Emirates": ["Office 204, Building 12, Business Bay", "Dubai, United Arab Emirates"],
  Germany: ["SwiftPak Logistics GmbH, Frachtweg 9", "60327 Frankfurt am Main, Germany"],
  China: ["Room 2101, Tower B, 88 Century Avenue, Pudong", "Shanghai 200120, China"],
  Singapore: ["28 Tuas Avenue 6, #03-11 SwiftPak Hub", "Singapore 639318"],
  "Hong Kong": ["Unit 806, 8/F, Harbour View Centre, 120 Texaco Road", "Tsuen Wan, Hong Kong"],
};