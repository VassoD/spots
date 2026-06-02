import JSZip from "jszip";

// Google "My Activity > Maps" exports as HTML. Each activity sits in a
// content-cell and links to the place via an ftid/cid URL whose trailing hex
// is the place CID, the same ID used by Saved Places. We match on that.

export interface ActivityHit {
  count: number;
  lastSeen: string | null; // human label, e.g. "Apr 2026"
  lastSeenSort: string; // YYYYMMDDHHMMSS for comparison
  actions: string[];
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Sept: "09", Oct: "10", Nov: "11", Dec: "12",
};

const CELL_RE = /<div class="content-cell[^"]*mdl-typography--body-1[^"]*">([\s\S]*?)<\/div>/g;
const HREF_RE = /href="([^"]+)"/g;
const DATE_RE = /(\d{1,2}) (\w+) (\d{4}), (\d{2}):(\d{2}):(\d{2})/;

function cidFromUrl(url: string): string | null {
  const hex = url.match(/(?:ftid|cid)=0x[0-9a-f]+(?:%3A|:)0x([0-9a-f]+)/i);
  if (hex) return BigInt(`0x${hex[1]}`).toString();
  const dec = url.match(/[?&]cid=(\d+)/);
  return dec ? dec[1] : null;
}

export function isActivityZip(zip: JSZip): boolean {
  return Object.keys(zip.files).some((n) => /My Activity\/.*\.html$/i.test(n));
}

export async function parseActivity(zip: JSZip): Promise<Map<string, ActivityHit>> {
  const hits = new Map<string, ActivityHit>();
  for (const file of Object.values(zip.files)) {
    if (file.dir || !/\.html$/i.test(file.name)) continue;
    const html = await file.async("string");
    for (const match of html.matchAll(CELL_RE)) {
      const cell = match[1];
      const hrefs = [...cell.matchAll(HREF_RE)].map((m) => m[1]);
      const placeLink = hrefs.find((h) => h.includes("maps.google") || h.includes("google.com/maps"));
      if (!placeLink) continue;
      const cid = cidFromUrl(placeLink);
      if (!cid) continue;

      const text = cell.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const action = cell.split("<a")[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Viewed";

      let lastSeen: string | null = null;
      let sort = "";
      const d = text.match(DATE_RE);
      if (d) {
        const mo = MONTHS[d[2]] ?? "00";
        sort = `${d[3]}${mo}${d[1].padStart(2, "0")}${d[4]}${d[5]}${d[6]}`;
        lastSeen = `${d[2]} ${d[3]}`;
      }

      const hit = hits.get(cid) ?? { count: 0, lastSeen: null, lastSeenSort: "", actions: [] };
      hit.count += 1;
      const shortAction = action.slice(0, 16);
      if (shortAction && !hit.actions.includes(shortAction)) hit.actions.push(shortAction);
      if (sort > hit.lastSeenSort) {
        hit.lastSeenSort = sort;
        hit.lastSeen = lastSeen;
      }
      hits.set(cid, hit);
    }
  }
  return hits;
}

export function mergeActivity(target: Map<string, ActivityHit>, source: Map<string, ActivityHit>): void {
  for (const [cid, hit] of source) {
    const existing = target.get(cid);
    if (!existing) {
      target.set(cid, hit);
      continue;
    }
    existing.count += hit.count;
    for (const a of hit.actions) if (!existing.actions.includes(a)) existing.actions.push(a);
    if (hit.lastSeenSort > existing.lastSeenSort) {
      existing.lastSeenSort = hit.lastSeenSort;
      existing.lastSeen = hit.lastSeen;
    }
  }
}
