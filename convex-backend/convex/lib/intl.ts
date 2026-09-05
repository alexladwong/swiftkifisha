// International Kifisha reference data (mirrors backend/src/lib/intl.js).
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
  "United Kingdom": ["Unit 7 SwiftKifisha House, 48 Farringdon Road", "London EC1M 3DG, United Kingdom"],
  "United Arab Emirates": ["Office 204, Building 12, Business Bay", "Dubai, United Arab Emirates"],
  Germany: ["SwiftKifisha Logistics GmbH, Frachtweg 9", "60327 Frankfurt am Main, Germany"],
  China: ["Room 2101, Tower B, 88 Century Avenue, Pudong", "Shanghai 200120, China"],
  Singapore: ["28 Tuas Avenue 6, #03-11 SwiftKifisha Hub", "Singapore 639318"],
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
export const UGANDA_CITY_COORDS: Record<string, [number, number]> = {
  Kampala: [0.3476, 32.5825], Entebbe: [0.0562, 32.4587], Jinja: [0.4244, 33.2039],
  Mbarara: [-0.6072, 30.6545], Gulu: [2.7746, 32.299], Mbale: [1.0784, 34.175],
  Mukono: [0.3533, 32.7553], Masaka: [-0.337, 31.7342], Lira: [2.2499, 32.8999],
  Kasese: [0.183, 30.083], "Fort Portal": [0.671, 30.274], Arua: [3.0183, 30.911],
  Soroti: [1.7146, 33.6111], Nansana: [0.3638, 32.525], Kira: [0.402, 32.635],
};

export const UGANDA_REGION_CENTROIDS: Record<string, [number, number]> = {
  Central: UGANDA_CITY_COORDS.Kampala,
  Eastern: [0.75, 33.7],
  Northern: [2.55, 32.6],
  Western: [-0.25, 30.5],
};

export function ugandaDistanceKm(a: string, b: string): number | null {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const pa = UGANDA_CITY_COORDS[a] || UGANDA_REGION_CENTROIDS[a];
  const pb = UGANDA_CITY_COORDS[b] || UGANDA_REGION_CENTROIDS[b];
  if (!pa || !pb) return null;
  const dLat = toRad(pb[0] - pa[0]);
  const dLng = toRad(pb[1] - pa[1]);
  const lat1 = toRad(pa[0]);
  const lat2 = toRad(pb[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.max(5, Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10);
}


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