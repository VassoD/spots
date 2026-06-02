"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { UploadHero } from "@/components/UploadHero";
import { PlacesPanel } from "@/components/PlacesPanel";
import { useProcessUpload } from "@/lib/use-process-upload";
import { clearResult, loadResult, saveResult } from "@/lib/storage";
import { mergeResults } from "@/lib/merge";
import type { ProcessResult } from "@/lib/types";

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

  // `current` is the displayed atlas; uploads either replace it or, in "adding"
  // mode, merge into it. It is persisted locally so it survives a reload.
  const [current, setCurrent] = useState<ProcessResult | null>(null);
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const effective = current;

  useEffect(() => {
    loadResult().then((stored) => {
      if (stored) {
        setCurrent(stored.result);
        setRestored(true);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (status !== "success" || !result) return;
    setCurrent((prev) => {
      const next = adding && prev ? mergeResults(prev, result) : result;
      void saveResult(next);
      return next;
    });
    setRestored(false);
    setAdding(false);
    reset();
  }, [status, result, adding, reset]);

  const handleReset = (): void => {
    void clearResult();
    setCurrent(null);
    setRestored(false);
    setAdding(false);
    reset();
  };

  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeCountry, setActiveCountry] = useState("");
  const [activeCity, setActiveCity] = useState("");
  const [visitFilter, setVisitFilter] = useState<"all" | "visited" | "wishlist">("all");
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
    if (!effective) return [];
    const q = search.trim().toLowerCase();
    return effective.places.filter((p) => {
      if (activeCategories.size > 0 && !activeCategories.has(p.category)) return false;
      if (activeCountry && p.country !== activeCountry) return false;
      if (activeCity && p.city !== activeCity) return false;
      if (visitFilter === "visited" && !p.visited) return false;
      if (visitFilter === "wishlist" && p.visited) return false;
      if (q && !`${p.name} ${p.address}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [effective, search, activeCategories, activeCountry, activeCity, visitFilter]);

  if (!hydrated) {
    return (
      <main className="relative z-10 flex min-h-screen items-center justify-center">
        <span className="eyebrow">opening your atlas…</span>
      </main>
    );
  }

  if (!effective || adding) {
    return (
      <UploadHero
        onProcess={process}
        loading={status === "loading"}
        error={error}
        addMode={adding}
        onCancel={adding ? () => setAdding(false) : undefined}
      />
    );
  }

  return (
    <div className="relative z-10 grid h-screen grid-rows-[45vh_55vh] md:grid-cols-[minmax(360px,30rem)_1fr] md:grid-rows-1">
      <aside className="order-2 min-h-0 border-t border-[var(--line)] md:order-1 md:border-r md:border-t-0">
        <PlacesPanel
          result={effective}
          restored={restored}
          places={filtered}
          onAddMore={() => setAdding(true)}
          search={search}
          setSearch={setSearch}
          activeCategories={activeCategories}
          toggleCategory={toggleCategory}
          activeCountry={activeCountry}
          setActiveCountry={setCountry}
          activeCity={activeCity}
          setActiveCity={setActiveCity}
          visitFilter={visitFilter}
          setVisitFilter={setVisitFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReset={handleReset}
        />
      </aside>
      <section className="order-1 min-h-0 md:order-2">
        <MapView places={filtered} selectedId={selectedId} onSelect={setSelectedId} />
      </section>
    </div>
  );
}
