"use client";

import { useCallback, useRef, useState } from "react";

interface UploadHeroProps {
  onProcess: (files: File[]) => void;
  loading: boolean;
  error: string | null;
}

function collectZips(list: FileList | null): File[] {
  if (!list) return [];
  return Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".zip"));
}

export function UploadHero({ onProcess, loading, error }: UploadHeroProps): React.ReactElement {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]): void => {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      const next = [...prev];
      for (const f of incoming) {
        if (!seen.has(f.name + f.size)) next.push(f);
      }
      return next;
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      setDragging(false);
      addFiles(collectZips(e.dataTransfer.files));
    },
    [addFiles],
  );

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="rise">
        <div className="mb-8 flex items-baseline gap-3">
          <span className="font-display text-2xl tracking-tight text-[var(--ink)]">Spots</span>
          <span className="eyebrow">all your spots, one map</span>
        </div>
        <h1 className="font-display text-[clamp(2.6rem,7vw,5.2rem)] font-light leading-[0.95] tracking-tight text-[var(--ink)]">
          Every place you ever
          <br />
          <span className="italic text-[var(--accent)]">saved</span>, on one map.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-soft)]">
          Scattered your favourite cafes, restaurants and sights across a dozen Google
          accounts? Drop your Takeout exports below. We merge them, drop the duplicates,
          and sort everything by country, city and category, automatically.
        </p>
      </div>

      <div
        className="rise mt-10"
        style={{ animationDelay: "0.12s" }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-6 py-14 text-center transition-colors"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--line)",
            backgroundColor: dragging ? "rgba(187,77,42,0.06)" : "var(--paper-2)",
          }}
        >
          <span
            className="font-display text-2xl text-[var(--ink)] transition-transform group-hover:-translate-y-0.5"
          >
            {dragging ? "Drop them right here" : "Drag your Takeout .zip files in"}
          </span>
          <span className="eyebrow">or click to browse</span>
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            multiple
            hidden
            onChange={(e) => addFiles(collectZips(e.target.files))}
          />
        </button>

        {files.length > 0 && (
          <ul className="mt-5 flex flex-col divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {files.map((f) => (
              <li key={f.name + f.size} className="flex items-center justify-between py-2.5">
                <span className="font-mono text-sm text-[var(--ink)]">{f.name}</span>
                <span className="font-mono text-xs text-[var(--ink-faint)]">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-4 font-mono text-sm text-[var(--accent)]">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={files.length === 0 || loading}
            onClick={() => onProcess(files)}
            className="rounded-sm bg-[var(--ink)] px-7 py-3 font-mono text-sm uppercase tracking-widest text-[var(--paper)] transition-all hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {loading ? "Reading your places…" : `Map my spots${files.length ? ` (${files.length})` : ""}`}
          </button>
          {files.length > 0 && !loading && (
            <button
              type="button"
              onClick={() => setFiles([])}
              className="font-mono text-xs uppercase tracking-widest text-[var(--ink-faint)] underline-offset-4 hover:underline"
            >
              clear
            </button>
          )}
        </div>
      </div>

      <Steps />
    </main>
  );
}

function Steps(): React.ReactElement {
  const steps: Array<[string, string]> = [
    ["01", "Open takeout.google.com on each account. Select Maps (your places). Export."],
    ["02", "Drop every .zip here. Filenames like name_takeout-….zip become account labels."],
    ["03", "It read each Saved Places file, merge, dedupe by place, and categorize via Maps."],
  ];
  return (
    <div className="rise mt-16 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3" style={{ animationDelay: "0.24s" }}>
      {steps.map(([n, text]) => (
        <div key={n} className="bg-[var(--paper)] p-5">
          <span className="font-mono text-xs text-[var(--accent)]">{n}</span>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{text}</p>
        </div>
      ))}
    </div>
  );
}
