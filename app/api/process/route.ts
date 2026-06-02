import { NextResponse } from "next/server";
import { parseTakeoutZips } from "@/lib/takeout";
import { enrichPlaces } from "@/lib/places-api";
import { citySortKey } from "@/lib/categorize";
import type { ProcessResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Expected multipart form data." } }, { status: 400 });
  }

  const uploads = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (uploads.length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "No files uploaded." } }, { status: 400 });
  }

  const zips = uploads.filter((f) => f.name.toLowerCase().endsWith(".zip"));
  if (zips.length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Upload Google Takeout .zip files." } }, { status: 400 });
  }

  try {
    const files = await Promise.all(
      zips.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })),
    );
    const { places, accounts, hasActivity } = await parseTakeoutZips(files);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    let enriched = false;
    if (apiKey && places.length > 0) {
      try {
        await enrichPlaces(places, apiKey);
        enriched = true;
      } catch {
        enriched = false; // fall back to name heuristics
      }
    }

    places.sort((a, b) => {
      const [ra, ca] = citySortKey(a.city);
      const [rb, cb] = citySortKey(b.city);
      if (ra !== rb) return ra - rb;
      if (ca !== cb) return ca < cb ? -1 : 1;
      return (a.arrondissement ?? 99) - (b.arrondissement ?? 99);
    });

    const byCategory: Record<string, number> = {};
    const cities = new Set<string>();
    let visited = 0;
    for (const p of places) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
      cities.add(p.city);
      if (p.visited) visited += 1;
    }

    const result: ProcessResult = {
      places,
      accounts,
      enriched,
      hasActivity,
      stats: { total: places.length, cities: cities.size, visited, byCategory },
    };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process uploads.";
    return NextResponse.json({ error: { code: "PROCESSING_FAILED", message } }, { status: 500 });
  }
}
