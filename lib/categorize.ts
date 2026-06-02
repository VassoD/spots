// Address parsing and category bucketing. Ported from the reference Python
// pipeline so the web app produces the same grouping as the CLI version.

const COUNTRY_EL_TO_EN: Record<string, string> = {
  Γαλλία: "France",
  Ουγγαρία: "Hungary",
  Κύπρος: "Cyprus",
  Καναδάς: "Canada",
  Ισπανία: "Spain",
  Ιταλία: "Italy",
  Ελλάδα: "Greece",
  Γερμανία: "Germany",
  Πορτογαλία: "Portugal",
  Βέλγιο: "Belgium",
  Ολλανδία: "Netherlands",
  "Ηνωμένο Βασίλειο": "United Kingdom",
};

const CITY_EL_TO_EN: Record<string, string> = {
  Αθήνα: "Athens",
  Athina: "Athens",
  Λεμεσός: "Limassol",
  Φηρά: "Santorini",
  "Νάξος και Μικρές Κυκλάδες": "Naxos",
};

const REGION_TO_CITY: Record<string, string> = {
  "Illes Balears": "Palma",
  "Balearic Islands": "Palma",
};

// Google primaryType -> friendly bucket. First keyword match wins.
const TYPE_BUCKETS: Array<[string, string[]]> = [
  ["Cafe / Coffee", ["coffee", "cafe", "cafeteria", "tea_house"]],
  ["Bakery / Pastry", ["bakery", "patisserie", "dessert", "ice_cream", "chocolate"]],
  ["Bar / Pub", ["bar", "pub", "night_club", "brewery"]],
  ["Restaurant", ["restaurant", "meal_takeaway", "meal_delivery", "fast_food", "_food", "diner", "steak", "brunch", "food_court"]],
  ["Sights / Attractions", ["tourist_attraction", "national_park", "park", "museum", "botanical_garden", "historical", "landmark", "monument", "church", "place_of_worship", "zoo", "aquarium", "art_gallery", "viewpoint"]],
  ["Shopping / Market", ["store", "market", "shopping", "mall", "boutique"]],
];

// Fallback heuristic from the place name when no API type is available.
const CATEGORY_RULES: Array<[string, string[]]> = [
  ["Cafe / Coffee", ["coffee", "café", "cafe", "espresso", "roaster"]],
  ["Bakery / Pastry", ["boulangerie", "patisserie", "pâtisserie", "bakery", "croissant"]],
  ["Bar / Pub", ["bar", "pub", "brasserie", "cocktail", "wine", "beer"]],
  ["Restaurant", ["restaurant", "cantine", "bistro", "bouffe", "kitchen", "grill", "resto", "bao", "sushi", "ramen", "poke", "burger", "pizza"]],
];

export const CATEGORY_ORDER: string[] = [
  "Cafe / Coffee",
  "Bakery / Pastry",
  "Restaurant",
  "Bar / Pub",
  "Sights / Attractions",
  "Shopping / Market",
  "Other",
  "Uncategorized",
];

export const CATEGORY_COLORS: Record<string, string> = {
  "Cafe / Coffee": "#b45309",
  "Bakery / Pastry": "#db2777",
  Restaurant: "#dc2626",
  "Bar / Pub": "#7c3aed",
  "Sights / Attractions": "#059669",
  "Shopping / Market": "#2563eb",
  Other: "#64748b",
  Uncategorized: "#94a3b8",
};

export function bucketFromType(primaryType: string | null | undefined): string | null {
  if (!primaryType) return null;
  const low = primaryType.toLowerCase();
  for (const [label, keywords] of TYPE_BUCKETS) {
    if (keywords.some((k) => low.includes(k))) return label;
  }
  return "Other";
}

export function guessCategory(name: string): string {
  const low = name.toLowerCase();
  for (const [label, keywords] of CATEGORY_RULES) {
    if (keywords.some((k) => low.includes(k))) return label;
  }
  return "Uncategorized";
}

function stripPostal(seg: string): string {
  let s = seg;
  s = s.replace(/\b\d{4}-\d{3}\b/g, ""); // Portugal 3000-037
  s = s.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/g, ""); // Canada J8E 3J3
  s = s.replace(/\b\d{3}\s\d{2}\b/g, ""); // Greece 105 54
  s = s.replace(/\b\d{4,6}\b/g, ""); // generic postal
  s = s.replace(/^\d{3}\s+/g, ""); // Iceland 101 Reykjavik
  s = s.replace(/\b[A-Z]{2}\b/g, ""); // province code e.g. QC
  return s.replace(/^[\s,-]+|[\s,-]+$/g, "");
}

export interface CityInfo {
  city: string;
  arrondissement: number | null;
  country: string;
}

// The last address segment is usually just the country, but some locales (e.g.
// Hungary: "1077 Ουγγαρία") fold the postal code into it. Strip a leading
// postal code, then translate from Greek when needed.
function countryFromSegment(segment: string): string {
  const stripped = segment.replace(/^\d{3,5}\s+/, "").trim();
  return COUNTRY_EL_TO_EN[stripped] ?? stripped;
}

export function parseCity(address: string): CityInfo {
  if (!address) return { city: "Unknown", arrondissement: null, country: "" };
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : "";
  const country = countryFromSegment(last);

  const m = address.match(/\b75(\d{3})\b/);
  if (m) {
    const arr = parseInt(m[1], 10);
    if (arr >= 1 && arr <= 20) return { city: "Paris", arrondissement: arr, country };
  }

  const segs = parts.length > 1 ? parts.slice(0, -1) : parts;
  let fallback = "";
  for (let i = segs.length - 1; i >= 0; i--) {
    let city = stripPostal(segs[i]);
    if (!city || /^\d+$/.test(city)) continue;
    city = REGION_TO_CITY[city] ?? city;
    city = CITY_EL_TO_EN[city] ?? city;
    if (!fallback) fallback = city;
    // A leftover house number means this is a street, not a city; keep looking.
    if (/\d/.test(city)) continue;
    return { city, arrondissement: null, country };
  }
  return { city: fallback || "Unknown", arrondissement: null, country };
}

export function cleanAddress(address: string): string {
  // Translate any Greek country name in place, even when it shares a segment
  // with a postal code (e.g. "1077 Ουγγαρία" -> "1077 Hungary").
  let out = address;
  for (const [el, en] of Object.entries(COUNTRY_EL_TO_EN)) {
    out = out.replace(el, en);
  }
  return out;
}

export function extractCid(url: string): string | null {
  const m = url.match(/cid=(\d+)/);
  return m ? m[1] : null;
}

export function citySortKey(city: string): [number, string] {
  if (city === "Paris") return [0, ""];
  if (city === "Unknown") return [2, ""];
  return [1, city.toLowerCase()];
}
