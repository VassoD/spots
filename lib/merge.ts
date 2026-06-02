import { citySortKey } from "./categorize";
import type { Place, ProcessResult } from "./types";

// Fold a freshly processed upload (b) into the existing atlas (a) at the place
// level, so users can add more accounts without re-uploading everything.

function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const [ra, ca] = citySortKey(a.city);
    const [rb, cb] = citySortKey(b.city);
    if (ra !== rb) return ra - rb;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (a.arrondissement ?? 99) - (b.arrondissement ?? 99);
  });
}

export function mergeResults(a: ProcessResult, b: ProcessResult): ProcessResult {
  const byId = new Map<string, Place>();
  for (const p of a.places) byId.set(p.id, { ...p, accounts: [...p.accounts] });

  for (const incoming of b.places) {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, { ...incoming, accounts: [...incoming.accounts] });
      continue;
    }
    for (const acc of incoming.accounts) {
      if (!existing.accounts.includes(acc)) existing.accounts.push(acc);
    }
    // Fill in API enrichment if this copy has it and the existing one does not.
    if (!existing.placeType && incoming.placeType) {
      existing.placeType = incoming.placeType;
      existing.category = incoming.category;
      existing.rating = incoming.rating;
      existing.priceLevel = incoming.priceLevel;
    }
    // Keep the stronger visit signal.
    if (incoming.visited) {
      existing.visited = true;
      existing.seenCount = Math.max(existing.seenCount, incoming.seenCount);
      existing.lastSeen = existing.lastSeen ?? incoming.lastSeen;
    }
  }

  const places = sortPlaces([...byId.values()]);
  const byCategory: Record<string, number> = {};
  const cities = new Set<string>();
  let visited = 0;
  for (const p of places) {
    byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    cities.add(p.city);
    if (p.visited) visited += 1;
  }

  return {
    places,
    accounts: [...new Set([...a.accounts, ...b.accounts])],
    enriched: a.enriched || b.enriched,
    hasActivity: a.hasActivity || b.hasActivity,
    stats: { total: places.length, cities: cities.size, visited, byCategory },
  };
}
