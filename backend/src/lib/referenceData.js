/**
 * Geographic / product reference data. Mirrors the city/country lists shipped
 * in the frontends (frontend/src/lib/locationData.js) so validation behaves
 * the same on both sides of the API.
 */
export const PAKISTANI_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
  "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Abbottabad",
  "Bahawalpur", "Sukkur", "Mardan",
];

export const PAKISTANI_CITY_OPTIONS = PAKISTANI_CITIES.map((c) => ({ value: c, label: c }));

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
  { country: "United Arab Emirates", capital: "Abu Dhabi" },
  { country: "United Kingdom", capital: "London" },
  { country: "United States", capital: "Washington, D.C." },
];

export const INTERNATIONAL_DESTINATION_OPTIONS = INTERNATIONAL_COUNTRIES_WITH_CAPITALS.map(
  ({ country, capital }) => ({ value: `${country}, ${capital}`, label: `${country}, ${capital}` }),
);

export const destinationOptionsForShipmentType = (shipmentType) =>
  shipmentType === "international" ? INTERNATIONAL_DESTINATION_OPTIONS : PAKISTANI_CITY_OPTIONS;

export const PARCEL_CATEGORIES = [
  "document", "electronics", "fragile", "clothing", "food", "medicine",
  "cosmetics", "books", "small_package", "large_package",
];

export const DELIVERY_TYPES = ["sameDay", "overnight", "standard"];
export const SHIPMENT_TYPES = ["national", "international"];
export const PARCEL_STATUSES = ["created", "arrived", "in_transit", "out_for_delivery", "delivered"];

/** Roughly realistic neighbourhoods per city, used by the demo seed. */
export const CITY_AREAS = {
  Karachi: ["Clifton", "Gulshan-e-Iqbal", "Gulberg", "DHA Phase 6", "Saddar", "Nazimabad", "Shah Faisal Colony", "Korangi"],
  Lahore: ["Gulberg III", "Model Town", "Johar Town", "DHA Phase 5", "Iqbal Town", "Wapda Town", "Faisal Town", "Township"],
  Islamabad: ["F-7 Markaz", "G-9", "G-11", "I-8", "E-11", "F-10", "DHA-II", "Bahria Enclave"],
  Rawalpindi: ["Satellite Town", "Westridge", "Bahria Town", "Chaklala", "Adiala Road", "Gulraiz Housing"],
  Faisalabad: ["Peoples Colony", "D Ground", "Madina Town", "Gulberg", "Satiana Road"],
  Multan: ["Gulgasht Colony", "Cantt", "Shah Rukn-e-Alam", "Model Town", "Wapda Town"],
  Peshawar: ["University Town", "Hayatabad", "Cantt", "Gulbahar", "Phase 7 Hayatabad"],
  Quetta: ["Cantt", "Satellite Town", "Jinnah Town", "Model Town"],
  Sialkot: ["Cantt", "Model Town", "Iqbal Town", "Samina Colony"],
  Gujranwala: ["Cantt", "Model Town", "Naya Pind", "Khalid Town"],
  Hyderabad: ["Latifabad", "Qasimabad", "Hirabad", "Gulistan-e-Sarmast"],
  Abbottabad: ["Supply Bazaar", "Jhangi", "Mirpur", "Mandian", "Nawan Shehr"],
  Bahawalpur: ["Model Town A", "Gulshan-e-Sadiq", "Cantt", "Satellite Town"],
  Sukkur: ["Cantt", "Rohri", "New Sukkur", "Gharibabad"],
  Mardan: ["Takht Bhai Road", "Cantt", "Shamshabad", "Par Hoti"],
};
const FALLBACK_AREAS = ["Main Bazaar", "City Center", "New Town", "Cantt Area"];

export function areaForCity(city) {
  const areas = CITY_AREAS[city];
  if (!areas) return FALLBACK_AREAS;
  return areas;
}
