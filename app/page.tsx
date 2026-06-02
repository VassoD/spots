"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { UploadHero } from "@/components/UploadHero";
import { PlacesPanel } from "@/components/PlacesPanel";
import { useProcessUpload } from "@/lib/use-process-upload";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[var(--paper-2)]">
      <span className="eyebrow">drawing the map…</span>
    </div>
  ),
});

export default function Home(): React.ReactElement {
  const { status, result, error, process, reset } = useProcessUpload();

  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeCountry, setActiveCountry] = useState("");
  const [activeCity, setActiveCity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Selecting a country clears a now-irrelevant city selection.
  const setCountry = (c: string): void => {
    setActiveCountry(c);
    setActiveCity("");
  };

  const toggleCategory = (c: string): void => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    return result.places.filter((p) => {
      if (activeCategories.size > 0 && !activeCategories.has(p.category)) return false;
      if (activeCountry && p.country !== activeCountry) return false;
      if (activeCity && p.city !== activeCity) return false;
      if (q && !`${p.name} ${p.address}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [result, search, activeCategories, activeCountry, activeCity]);

  if (status !== "success" || !result) {
    return <UploadHero onProcess={process} loading={status === "loading"} error={error} />;
  }

  return (
    <div className="relative z-10 grid h-screen grid-rows-[45vh_55vh] md:grid-cols-[minmax(360px,30rem)_1fr] md:grid-rows-1">
      <aside className="order-2 min-h-0 border-t border-[var(--line)] md:order-1 md:border-r md:border-t-0">
        <PlacesPanel
          result={result}
          places={filtered}
          search={search}
          setSearch={setSearch}
          activeCategories={activeCategories}
          toggleCategory={toggleCategory}
          activeCountry={activeCountry}
          setActiveCountry={setCountry}
          activeCity={activeCity}
          setActiveCity={setActiveCity}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReset={reset}
        />
      </aside>
      <section className="order-1 min-h-0 md:order-2">
        <MapView places={filtered} selectedId={selectedId} onSelect={setSelectedId} />
      </section>
    </div>
  );
}
