import { bucketFromType } from "./categorize";
import type { Place } from "./types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const LOCATION_BIAS_RADIUS_M = 120;
const FIELD_MASK = "places.primaryType,places.types,places.rating,places.priceLevel";
const CONCURRENCY = 8;

interface SearchHit {
  primaryType?: string;
  types?: string[];
  rating?: number;
  priceLevel?: string;
}

async function searchPlace(apiKey: string, place: Place): Promise<SearchHit | null> {
  if (place.lat === null || place.lon === null) return null;
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: place.name,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: { latitude: place.lat, longitude: place.lon },
          radius: LOCATION_BIAS_RADIUS_M,
        },
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Places API ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { places?: SearchHit[] };
  return data.places?.[0] ?? null;
}

// Enrich in place with bounded concurrency. Mutates and returns the same array.
export async function enrichPlaces(places: Place[], apiKey: string): Promise<Place[]> {
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < places.length) {
      const index = cursor++;
      const place = places[index];
      try {
        const hit = await searchPlace(apiKey, place);
        if (hit) {
          place.placeType = hit.primaryType ?? "";
          place.rating = hit.rating ?? null;
          place.priceLevel = hit.priceLevel ?? null;
          place.category = bucketFromType(hit.primaryType) ?? place.category;
        }
      } catch {
        // Leave the heuristic category on failure; never break the whole upload.
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return places;
}
