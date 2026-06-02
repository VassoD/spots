"use client";

import { useMemo } from "react";
import { CATEGORY_COLORS, CATEGORY_ORDER, citySortKey } from "@/lib/categorize";
import type { Place, ProcessResult } from "@/lib/types";

interface PlacesPanelProps {
  result: ProcessResult;
  restored: boolean;
  places: Place[];
  search: string;
  setSearch: (v: string) => void;
  activeCategories: Set<string>;
  toggleCategory: (c: string) => void;
  activeCountry: string;
  setActiveCountry: (c: string) => void;
  activeCity: string;
  setActiveCity: (c: string) => void;
  visitFilter: "all" | "visited" | "wishlist";
  setVisitFilter: (v: "all" | "visited" | "wishlist") => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReset: () => void;
  onAddMore: () => void;
}

function priceLabel(level: string | null): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_INEXPENSIVE: "€",
    PRICE_LEVEL_MODERATE: "€€",
    PRICE_LEVEL_EXPENSIVE: "€€€",
    PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
  };
  return level ? map[level] ?? "" : "";
}

export function PlacesPanel(props: PlacesPanelProps): React.ReactElement {
  const { result, restored, places, search, setSearch, activeCategories, toggleCategory } = props;
  const { activeCountry, setActiveCountry, activeCity, setActiveCity } = props;
  const { visitFilter, setVisitFilter, selectedId, onSelect, onReset, onAddMore } = props;

  const categories = useMemo(
    () =>
      CATEGORY_ORDER.filter((c) => result.stats.byCategory[c]).map((c) => ({
        name: c,
        count: result.stats.byCategory[c],
      })),
    [result.stats.byCategory],
  );

  const countries = useMemo(() => {
    const set = new Set(result.places.map((p) => p.country).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [result.places]);

  // Cities narrow to the selected country so the two dropdowns stay coherent.
  const cities = useMemo(() => {
    const set = new Set(
      result.places
        .filter((p) => !activeCountry || p.country === activeCountry)
        .map((p) => p.city),
    );
    return [...set].sort((a, b) => {
      const [ra, ca] = citySortKey(a);
      const [rb, cb] = citySortKey(b);
      return ra - rb || ca.localeCompare(cb);
    });
  }, [result.places, activeCountry]);

  const grouped = useMemo(() => {
    const byCity = new Map<string, Map<string, Place[]>>();
    for (const p of places) {
      if (!byCity.has(p.city)) byCity.set(p.city, new Map());
      const cat = byCity.get(p.city)!;
      if (!cat.has(p.category)) cat.set(p.category, []);
      cat.get(p.category)!.push(p);
    }
    return [...byCity.entries()].sort((a, b) => {
      const [ra, ca] = citySortKey(a[0]);
      const [rb, cb] = citySortKey(b[0]);
      return ra - rb || ca.localeCompare(cb);
    });
  }, [places]);

  return (
    <div className="flex h-full flex-col bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] px-6 pb-4 pt-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-3xl tracking-tight text-[var(--ink)]">Spots</h1>
          <div className="flex items-baseline gap-3">
            <button
              onClick={onAddMore}
              className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--accent)] underline-offset-4 hover:underline"
            >
              + add accounts
            </button>
            <button
              onClick={onReset}
              className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
            >
              start over
            </button>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-[var(--ink-soft)]">
          <span className="text-[var(--ink)]">{result.stats.total}</span> places ·{" "}
          <span className="text-[var(--ink)]">{result.stats.cities}</span> cities ·{" "}
          <span className="text-[var(--ink)]">{result.accounts.length}</span> accounts
          {result.hasActivity && (
            <>
              {" · "}
              <span className="text-[var(--accent)]">{result.stats.visited}</span> seen
            </>
          )}
        </p>
        {restored && (
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--ink-faint)]">
            restored from this device · start over to re-upload
          </p>
        )}
      </header>

      <div className="border-b border-[var(--line)] px-6 py-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a place or street…"
          className="w-full border-b border-[var(--line)] bg-transparent pb-2 font-sans text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none"
        />

        {result.hasActivity && (
          <div className="mt-4 flex rounded-sm border border-[var(--line)] p-0.5">
            {(["all", "visited", "wishlist"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setVisitFilter(opt)}
                className="flex-1 rounded-[3px] py-1.5 font-mono text-[0.65rem] uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: visitFilter === opt ? "var(--ink)" : "transparent",
                  color: visitFilter === opt ? "var(--paper)" : "var(--ink-soft)",
                }}
              >
                {opt === "all" ? "All" : opt === "visited" ? "Been there" : "Wishlist"}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const active = activeCategories.size === 0 || activeCategories.has(c.name);
            return (
              <button
                key={c.name}
                onClick={() => toggleCategory(c.name)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider transition-all"
                style={{
                  borderColor: active ? "transparent" : "var(--line)",
                  backgroundColor: active ? CATEGORY_COLORS[c.name] : "transparent",
                  color: active ? "#fff" : "var(--ink-faint)",
                }}
              >
                {c.name.replace(" / ", "/")} <span className="opacity-70">{c.count}</span>
              </button>
            );
          })}
        </div>

        {(countries.length > 1 || cities.length > 1) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <select
              value={activeCountry}
              onChange={(e) => setActiveCountry(e.target.value)}
              className="w-full rounded-sm border border-[var(--line)] bg-[var(--paper-2)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={activeCity}
              onChange={(e) => setActiveCity(e.target.value)}
              className="w-full rounded-sm border border-[var(--line)] bg-[var(--paper-2)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="scroll-paper flex-1 overflow-y-auto px-6 py-2">
        {grouped.length === 0 && (
          <p className="py-12 text-center font-mono text-xs text-[var(--ink-faint)]">
            Nothing matches those filters.
          </p>
        )}
        {grouped.map(([city, byCat]) => {
          const total = [...byCat.values()].reduce((n, arr) => n + arr.length, 0);
          return (
            <section key={city} className="py-4">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-xl text-[var(--ink)]">{city}</h2>
                <span className="hairline flex-1" />
                <span className="font-mono text-xs text-[var(--ink-faint)]">{total}</span>
              </div>
              {CATEGORY_ORDER.filter((c) => byCat.has(c)).map((cat) => (
                <div key={cat} className="mt-3">
                  <p
                    className="eyebrow mb-1.5 flex items-center gap-2"
                    style={{ color: CATEGORY_COLORS[cat] }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    {cat}
                  </p>
                  <ul>
                    {byCat
                      .get(cat)!
                      .slice()
                      .sort((a, b) => (a.arrondissement ?? 99) - (b.arrondissement ?? 99) || a.name.localeCompare(b.name))
                      .map((p) => (
                        <li key={p.id}>
                          <button
                            onClick={() => onSelect(p.id)}
                            className="group flex w-full items-baseline gap-2 rounded-sm py-1.5 pl-3 pr-2 text-left transition-colors"
                            style={{
                              backgroundColor: selectedId === p.id ? "var(--paper-3)" : "transparent",
                              borderLeft: `2px solid ${selectedId === p.id ? CATEGORY_COLORS[cat] : "transparent"}`,
                            }}
                          >
                            <span className="font-sans text-sm text-[var(--ink)] group-hover:text-[var(--accent)]">
                              {p.name}
                            </span>
                            {p.arrondissement && (
                              <span className="font-mono text-[0.65rem] text-[var(--ink-faint)]">
                                {p.arrondissement}e
                              </span>
                            )}
                            <span className="hairline mx-1 flex-1 self-center opacity-50" />
                            {p.visited && (
                              <span
                                className="font-mono text-[0.6rem] text-[var(--accent)]"
                                title={`Seen ${p.seenCount}× in your Maps activity${p.lastSeen ? `, last ${p.lastSeen}` : ""}`}
                              >
                                ✓{p.seenCount > 1 ? `${p.seenCount}` : ""}
                              </span>
                            )}
                            {p.rating && (
                              <span className="font-mono text-[0.65rem] text-[var(--ink-soft)]">★{p.rating}</span>
                            )}
                            {priceLabel(p.priceLevel) && (
                              <span className="font-mono text-[0.65rem] text-[var(--ink-faint)]">
                                {priceLabel(p.priceLevel)}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
