/**
 * Geographic / product reference data. Mirrors the lists shipped in the
 * frontends (frontend/src/lib/locationData.js) so validation behaves the same
 * on both sides of the API.
 */
export const UGANDA_REGIONS = {
  Central: ["Kampala", "Entebbe", "Mukono", "Nansana", "Kira", "Masaka"],
  Eastern: ["Jinja", "Mbale", "Soroti"],
  Northern: ["Gulu", "Lira", "Arua"],
  Western: ["Mbarara", "Kasese", "Fort Portal"],
};
export const UGANDA_REGION_NAMES = Object.keys(UGANDA_REGIONS);
export const UGANDA_CITIES = Object.values(UGANDA_REGIONS).flat();

export const UGANDA_CITY_OPTIONS = UGANDA_CITIES.map((c) => ({ value: c, label: c }));

export const INTERNATIONAL_COUNTRIES_WITH_CAPITALS = [
  { country: "Afghanistan", capital: "Kabul" },
  { country: "Bahrain", capital: "Manama" },
  { country: "Bangladesh", capital: "Dhaka" },
  { country: "China", capital: "Beijing" },
  { country: "Germany", capital: "Berlin" },
  { country: "India", capital: "New Delhi" },
  { country: "Iran", capital: "Tehran" },
  { country: "Iraq", capital: "Baghdad" },
  { country: "Japan", capital: "Tokyo" },
  { country: "Kuwait", capital: "Kuwait City" },
  { country: "Malaysia", capital: "Kuala Lumpur" },
  { country: "Oman", capital: "Muscat" },
  { country: "Qatar", capital: "Doha" },
  { country: "Russia", capital: "Moscow" },
  { country: "Saudi Arabia", capital: "Riyadh" },
  { country: "Singapore", capital: "Singapore" },
  { country: "South Korea", capital: "Seoul" },
  { country: "Turkey", capital: "Ankara" },
  { country: "Uganda", capital: "Kampala" },
  { country: "United Arab Emirates", capital: "Abu Dhabi" },
  { country: "United Kingdom", capital: "London" },
  { country: "United States", capital: "Washington, D.C." },
];

export const INTERNATIONAL_DESTINATION_OPTIONS = INTERNATIONAL_COUNTRIES_WITH_CAPITALS.map(
  ({ country, capital }) => ({ value: `${country}, ${capital}`, label: `${country}, ${capital}` }),
);

export const destinationOptionsForShipmentType = (shipmentType) =>
  shipmentType === "international" ? INTERNATIONAL_DESTINATION_OPTIONS : UGANDA_CITY_OPTIONS;



/** Approximate coordinates (lat, lng) for the Ugandan cities we serve. */
export const UGANDA_CITY_COORDS = {
  Kampala: [0.3476, 32.5825], Entebbe: [0.0562, 32.4587], Jinja: [0.4244, 33.2039],
  Mbarara: [-0.6072, 30.6545], Gulu: [2.7746, 32.299], Mbale: [1.0784, 34.175],
  Mukono: [0.3533, 32.7553], Masaka: [-0.337, 31.7342], Lira: [2.2499, 32.8999],
  Kasese: [0.183, 30.083], "Fort Portal": [0.671, 30.274], Arua: [3.0183, 30.911],
  Soroti: [1.7146, 33.6111], Nansana: [0.3638, 32.525], Kira: [0.402, 32.635],
};

/** Region centroids used when a whole region is the origin/destination. */
export const UGANDA_REGION_CENTROIDS = {
  Central: UGANDA_CITY_COORDS.Kampala,
  Eastern: [0.75, 33.7],
  Northern: [2.55, 32.6],
  Western: [-0.25, 30.5],
};

/** Straight-line distance in km between two Ugandan places (city or region). */
export function ugandaDistanceKm(a, b) {
  const toRad = (n) => (Number(n) * Math.PI) / 180;
  const pa = UGANDA_CITY_COORDS[a] || UGANDA_REGION_CENTROIDS[a];
  const pb = UGANDA_CITY_COORDS[b] || UGANDA_REGION_CENTROIDS[b];
  if (!pa || !pb) return null;
  const dLat = toRad(pb[0] - pa[0]);
  const dLng = toRad(pb[1] - pa[1]);
  const lat1 = toRad(pa[0]);
  const lat2 = toRad(pb[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.max(5, Math.round((6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))) * 10) / 10);
}

export const PARCEL_CATEGORIES = [
  "document", "electronics", "fragile", "clothing", "food", "medicine",
  "cosmetics", "books", "small_package", "large_package",
];

export const DELIVERY_TYPES = ["sameDay", "overnight", "standard"];
export const SHIPMENT_TYPES = ["national", "international"];
export const PARCEL_STATUSES = ["created", "arrived", "in_transit", "out_for_delivery", "delivered"];

/** Roughly realistic neighbourhoods per city, used by the demo seed. */
export const CITY_AREAS = {
  Kampala: ["Kololo", "Nakasero", "Kampala Central", "Makindye", "Muyenga", "Naguru", "Ntinda", "Bukoto"],
  Entebbe: ["Entebbe Town", "Nakiwogo", "Kitooro", "Bwerenga"],
  Jinja: ["Jinja Central", "Nalufenya", "Masese", "Walukuba"],
  Mbarara: ["Mbarara Town", "Nyakayojo", "Kakoba", "Boma"],
  Gulu: ["Gulu Town", "Laroo", "Pece", "Bardege"],
  Mbale: ["Mbale Town", "Namatala", "Malukhu", "Industrial Area"],
  Mukono: ["Mukono Town", "Seeta", "Namilyango", "Kyabakuza"],
  Masaka: ["Masaka Town", "Nyendo", "Kimaanya", "Katwe"],
  Lira: ["Lira Town", "Adyel", "Ogwette", "Railways"],
  Kasese: ["Kasese Town", "Rukooki", "Nyamwamba", "Kilembe"],
  "Fort Portal": ["Fort Portal Town", "Mugusi", "Kyarusozi Road", "Rwenzori"],
  Arua: ["Arua Town", "Oli", "Pamuku", "Awindiri"],
  Soroti: ["Soroti Town", "Arapai", "Ochuloi", "Moruapesur"],
  Nansana: ["Nansana Town", "Busega", "Wakiso Road", "Masooli"],
  Kira: ["Kira Town", "Bweyogerere", "Nalya", "Bulindo"],
};
const FALLBACK_AREAS = ["Main Bazaar", "City Center", "New Town", "Cantt Area"];

export function areaForCity(city) {
  const areas = CITY_AREAS[city];
  if (!areas) return FALLBACK_AREAS;
  return areas;
}