import JSZip from "jszip";
import { cleanAddress, extractCid, parseCity, guessCategory } from "./categorize";
import { isActivityZip, parseActivity, mergeActivity, type ActivityHit } from "./activity";
import type { Place, RawPlace } from "./types";

// A Takeout "Saved Places" file is a GeoJSON FeatureCollection whose features
// carry a google_maps_url / location. Reviews look similar but we prefer the
// file explicitly named "saved". We detect by content so language doesn't matter.

interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    date?: string;
    google_maps_url?: string;
    location?: { address?: string; name?: string; country_code?: string };
  };
}

interface GeoCollection {
  type?: string;
  features?: GeoFeature[];
}

const SAVED_NAME_HINTS = ["saved places", "αποθηκευμ"];

function looksLikeSavedPlaces(obj: unknown): obj is GeoCollection {
  if (!obj || typeof obj !== "object") return false;
  const c = obj as GeoCollection;
  if (c.type !== "FeatureCollection" || !Array.isArray(c.features)) return false;
  return c.features.some(
    (f) => f.properties?.google_maps_url !== undefined || f.properties?.location !== undefined,
  );
}

function accountNameFromFile(fileName: string, index: number): string {
  // "vassodor_takeout-2026....zip" -> "vassodor". A prefixless Takeout export
  // (e.g. "takeout-2026….zip") has no account hint, so fall back to a number.
  const base = fileName.replace(/\.zip$/i, "");
  const underscore = base.indexOf("_takeout");
  if (underscore > 0) return base.slice(0, underscore);
  const m = base.match(/^(?!takeout)([a-zA-Z0-9.+-]+?)[-_]takeout/i);
  return m ? m[1] : `Account ${index + 1}`;
}

async function extractSavedFeatures(zip: JSZip): Promise<GeoFeature[]> {
  const candidates: Array<{ named: boolean; count: number; features: GeoFeature[] }> = [];
  const jsonFiles = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".json"),
  );
  for (const file of jsonFiles) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.async("string"));
    } catch {
      continue;
    }
    if (looksLikeSavedPlaces(parsed)) {
      const lower = file.name.toLowerCase();
      const named = SAVED_NAME_HINTS.some((h) => lower.includes(h));
      candidates.push({ named, count: parsed.features?.length ?? 0, features: parsed.features ?? [] });
    }
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => Number(b.named) - Number(a.named) || b.count - a.count);
  return candidates[0].features;
}

function toRawPlace(feat: GeoFeature, account: string): RawPlace | null {
  const loc = feat.properties?.location ?? {};
  const name = (loc.name ?? "").trim();
  const address = (loc.address ?? "").trim();
  if (!name && !address) return null;
  const url = feat.properties?.google_maps_url ?? "";
  const coords = feat.geometry?.coordinates ?? [null, null];
  return {
    name: name || "(unnamed)",
    address,
    lat: coords[1] ?? null,
    lon: coords[0] ?? null,
    url,
    cid: extractCid(url),
    savedDate: feat.properties?.date ?? "",
    account,
  };
}

export interface ParsedUpload {
  places: Place[];
  accounts: string[];
  hasActivity: boolean;
}

export async function parseTakeoutZips(
  files: Array<{ name: string; buffer: ArrayBuffer }>,
): Promise<ParsedUpload> {
  const byKey = new Map<string, Place>();
  const accounts: string[] = [];
  const activity = new Map<string, ActivityHit>();
  let hasActivity = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const zip = await JSZip.loadAsync(file.buffer);

    // A My Activity export carries visit history, not saved places.
    if (isActivityZip(zip)) {
      hasActivity = true;
      mergeActivity(activity, await parseActivity(zip));
      continue;
    }

    const account = accountNameFromFile(file.name, i);
    if (!accounts.includes(account)) accounts.push(account);
    const features = await extractSavedFeatures(zip);

    for (const feat of features) {
      const raw = toRawPlace(feat, account);
      if (!raw) continue;
      const key = raw.cid ?? `${raw.name}|${raw.address}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.accounts.includes(account)) existing.accounts.push(account);
        continue;
      }
      const { city, arrondissement, country } = parseCity(raw.address);
      byKey.set(key, {
        id: key,
        name: raw.name,
        address: cleanAddress(raw.address),
        category: guessCategory(raw.name),
        placeType: "",
        rating: null,
        priceLevel: null,
        city,
        arrondissement,
        country,
        lat: raw.lat,
        lon: raw.lon,
        url: raw.url,
        savedDate: raw.savedDate,
        accounts: [account],
        visited: false,
        seenCount: 0,
        lastSeen: null,
      });
    }
  }

  // Annotate saved places that show up in Maps activity (matched by CID).
  for (const place of byKey.values()) {
    const hit = activity.get(place.id);
    if (hit) {
      place.visited = true;
      place.seenCount = hit.count;
      place.lastSeen = hit.lastSeen;
    }
  }

  return { places: [...byKey.values()], accounts, hasActivity };
}
