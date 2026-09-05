// International shop-and-ship reference data (mirrors backend/src/lib/intl.js).
export const FX_UGX_PER_USD = 3700;

export const HUB_COUNTRIES = [
  { country: "United States", code: "US", city: "New York", pickupFee: 15 },
  { country: "United Kingdom", code: "GB", city: "London", pickupFee: 15 },
  { country: "United Arab Emirates", code: "AE", city: "Dubai", pickupFee: 12 },
  { country: "Germany", code: "DE", city: "Frankfurt", pickupFee: 16 },
  { country: "China", code: "CN", city: "Shanghai", pickupFee: 14 },
  { country: "Singapore", code: "SG", city: "Singapore", pickupFee: 13 },
  { country: "Hong Kong", code: "HK", city: "Hong Kong", pickupFee: 13 },
];

export const HUB_MAILBOX_EXAMPLES: Record<string, string[]> = {
  "United States": ["101 Fifth Avenue, Suite SP-100", "New York, NY 10003, USA"],
  "United Kingdom": ["Unit 7 SwiftUg House, 48 Farringdon Road", "London EC1M 3DG, United Kingdom"],
  "United Arab Emirates": ["Office 204, Building 12, Business Bay", "Dubai, United Arab Emirates"],
  Germany: ["SwiftUg Logistics GmbH, Frachtweg 9", "60327 Frankfurt am Main, Germany"],
  China: ["Room 2101, Tower B, 88 Century Avenue, Pudong", "Shanghai 200120, China"],
  Singapore: ["28 Tuas Avenue 6, #03-11 SwiftUg Hub", "Singapore 639318"],
  "Hong Kong": ["Unit 806, 8/F, Harbour View Centre, 120 Texaco Road", "Tsuen Wan, Hong Kong"],
};

export const WORLD_COUNTRIES = [
  "Afghanistan","Australia","Austria","Bahrain","Bangladesh","Belgium","Brazil","Canada","China","Denmark",
  "Egypt","Finland","France","Germany","Greece","Hong Kong","India","Indonesia","Iran","Iraq","Ireland",
  "Italy","Japan","Jordan","Kenya","Kuwait","Lebanon","Malaysia","Maldives","Netherlands","New Zealand",
  "Nigeria","Norway","Oman","Uganda","Philippines","Poland","Qatar","Romania","Russia","Saudi Arabia",
  "Singapore","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland","Turkey",
  "United Arab Emirates","United Kingdom","United States",
];

export const WORLD_WITH_CAPITALS: Array<[string, string]> = [
  ["Afghanistan","Kabul"],["Australia","Canberra"],["Austria","Vienna"],["Bahrain","Manama"],["Bangladesh","Dhaka"],
  ["Belgium","Brussels"],["Brazil","Brasilia"],["Canada","Ottawa"],["China","Beijing"],["Denmark","Copenhagen"],
  ["Egypt","Cairo"],["Finland","Helsinki"],["France","Paris"],["Germany","Berlin"],["Greece","Athens"],
  ["Hong Kong","Hong Kong"],["India","New Delhi"],["Indonesia","Jakarta"],["Iran","Tehran"],["Iraq","Baghdad"],
  ["Ireland","Dublin"],["Italy","Rome"],["Japan","Tokyo"],["Jordan","Amman"],["Kenya","Nairobi"],
  ["Kuwait","Kuwait City"],["Lebanon","Beirut"],["Malaysia","Kuala Lumpur"],["Maldives","Male"],
  ["Netherlands","Amsterdam"],["New Zealand","Wellington"],["Nigeria","Lagos"],["Norway","Oslo"],["Oman","Muscat"],
  ["Uganda","Kampala"],["Philippines","Manila"],["Poland","Warsaw"],["Qatar","Doha"],["Romania","Bucharest"],
  ["Russia","Moscow"],["Saudi Arabia","Riyadh"],["Singapore","Singapore"],["South Africa","Cape Town"],
  ["South Korea","Seoul"],["Spain","Madrid"],["Sri Lanka","Colombo"],["Sweden","Stockholm"],["Switzerland","Bern"],
  ["Turkey","Ankara"],["United Arab Emirates","Abu Dhabi"],["United Kingdom","London"],["United States","Washington, D.C."],
];

export const UGANDA_REGIONS: Record<string, string[]> = {
  Central: ["Kampala", "Entebbe", "Mukono", "Nansana", "Kira", "Masaka"],
  Eastern: ["Jinja", "Mbale", "Soroti"],
  Northern: ["Gulu", "Lira", "Arua"],
  Western: ["Mbarara", "Kasese", "Fort Portal"],
};
export const UGANDA_REGION_NAMES = Object.keys(UGANDA_REGIONS);
export const UGANDA_CITIES = Object.values(UGANDA_REGIONS).flat();

export const CATEGORIES = [
  "document","electronics","fragile","clothing","food","medicine","cosmetics","books","small_package","large_package",
];
export const DELIVERY_TYPES = ["sameDay", "overnight", "standard"];
export const SHIPMENT_TYPES = ["national", "international"];
export const STATUSES = ["created", "arrived", "in_transit", "out_for_delivery", "delivered"];

const ZONES = [
  { name: "Zone 1", perKg: 7, countries: ["Afghanistan","Bahrain","Egypt","India","Iran","Iraq","Jordan","Kuwait","Lebanon","Oman","Uganda","Qatar","Saudi Arabia","Turkey","United Arab Emirates"] },
  { name: "Zone 2", perKg: 8.5, countries: ["Australia","Bangladesh","China","Hong Kong","Indonesia","Japan","Malaysia","Maldives","New Zealand","Philippines","Singapore","South Korea","Sri Lanka"] },
  { name: "Zone 3", perKg: 9.5, countries: ["Austria","Belgium","Denmark","Finland","France","Germany","Greece","Ireland","Italy","Netherlands","Norway","Poland","Romania","Russia","Spain","Sweden","Switzerland","United Kingdom"] },
  { name: "Zone 4", perKg: 11, countries: ["Brazil","Canada","Kenya","Nigeria","South Africa","United States"] },
];

export function zonePerKg(country: string): number {
  const zone = ZONES.find((z) => z.countries.includes(country));
  return zone ? zone.perKg : ZONES[ZONES.length - 1].perKg;
}