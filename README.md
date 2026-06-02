# Spots

All your spots, one map. A web app that turns Google Maps "Saved places" exports into one merged, deduplicated,
categorized map. Drop in Google Takeout `.zip` files from any number of accounts and the
app parses each account's saved places, removes duplicates, derives city and Paris
arrondissement from the address, categorizes every place via the Google Places API, and
shows the result as a filterable list beside an interactive map.

## Setup

```bash
npm install
```

Create `.env.local` with a Google Maps Platform key (Places API New enabled):

```
GOOGLE_MAPS_API_KEY=your_key_here
```

Without a key the app still works, it just falls back to categorizing by place name
instead of the Places API.

## Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```

## How to get the exports

For each Google account: open [takeout.google.com](https://takeout.google.com), deselect
all, select **Maps (your places)**, export, and download the zip. Name each file like
`yourname_takeout-….zip` so the account label is readable; otherwise it falls back to
`Account 1`, `Account 2`, etc.

## Architecture

- `lib/takeout.ts` reads each zip in memory (JSZip), finds the Saved Places GeoJSON by
  content (language-independent), and merges + dedupes by Google CID.
- `lib/categorize.ts` parses city/arrondissement/country and maps Google place types to
  friendly buckets.
- `lib/places-api.ts` enriches each place via `places:searchText`, resolving by name plus
  coordinates. The key stays server-side.
- `app/api/process/route.ts` is the upload endpoint that ties these together.
- `app/page.tsx` holds the shared filter state; `MapView` (Leaflet) and `PlacesPanel`
  render from the same filtered set.

## Notes

- Enrichment uses the server's API key for every upload, so the deployer pays for all
  users' lookups. For a public deployment, add per-user keys, rate limiting, or a results
  cache before opening it up.
- Place category is not present in Takeout, it is inferred. "Other" (hotels, schools,
  airports) and "Uncategorized" are expected for non-food saved places.
