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