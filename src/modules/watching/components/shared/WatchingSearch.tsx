"use client";

/**
 * The catalogue search — "what exists?", as opposed to ⌘K's "where is my thing?".
 *
 * Those are two different questions and they deliberately live apart. ⌘K searches YOUR rows
 * across every module; this searches TMDB, including the thousands of titles you have never
 * added. Merging them would mean typing "Dune" and getting your Dune next to the world's Dune —
 * the same name twice, meaning two different things, in one list.
 *
 * A result never guesses whether you own it: it always routes to /discover, and that page hands
 * you to your real fiche if the title turns out to be yours. One rule, no stale ownership cache
 * to keep in sync here.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Search, X } from "lucide-react";
import { SearchInput } from "@/shared/components/ui/search-input";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useSearchTmdbForList } from "../../hooks/useMediaLists";
import { tmdbResultType } from "../../service";
import type { TmdbListResult } from "../../types";

const TYPE_LABEL = { film: "Movie", serie: "TV", anime: "Anime" } as const;

function yearOf(r: TmdbListResult): string | null {
  const d = r.release_date || r.first_air_date;
  return d ? String(new Date(d).getFullYear()) : null;
}

function Results({
  results, loading, query, onPick,
}: {
  results: TmdbListResult[];
  loading: boolean;
  query: string;
  onPick: (r: TmdbListResult) => void;
}) {
  if (query.trim().length < 2) {
    return <p className="px-3 py-6 text-center text-xs text-text-tertiary">Type to search the catalogue.</p>;
  }
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={14} className="animate-spin text-text-tertiary" />
      </div>
    );
  }
  if (results.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-text-tertiary">Nothing found for “{query}”.</p>;
  }

  return (
    <ul className="max-h-96 overflow-y-auto py-1 scrollbar-hide">
      {results.map((r) => {
        const type = tmdbResultType(r);
        const year = yearOf(r);
        return (
          <li key={`${r.media_type}-${r.id}`}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-tile bg-surface-2">
                {r.poster_path && (
                  <Image
                    src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{r.title}</p>
                <p className="mt-0.5 truncate text-micro text-text-tertiary">
                  {TYPE_LABEL[type]}{year ? ` · ${year}` : ""}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function WatchingSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);          // desktop dropdown
  const [sheetOpen, setSheetOpen] = useState(false); // mobile full-screen
  const debounced = useDebounce(query, 200);
  const { data: results = [], isFetching } = useSearchTmdbForList(debounced);
  const boxRef = useRef<HTMLDivElement>(null);

  // A dropdown that outlives the click that dismissed it is the classic bug — close on any
  // click outside, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (r: TmdbListResult) => {
    setOpen(false);
    setSheetOpen(false);
    setQuery("");
    router.push(`/perso/watching/discover/${tmdbResultType(r)}/${r.id}`);
  };

  return (
    <>
      {/* ── Desktop: the field lives in the header ── */}
      <div ref={boxRef} className="relative hidden sm:block">
        <SearchInput
          size="sm"
          containerClassName="w-52"
          placeholder="Search titles…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClear={() => { setQuery(""); setOpen(false); }}
        />
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-card border border-border-strong bg-surface-3 shadow-2xl">
            <Results results={results} loading={isFetching} query={query} onPick={pick} />
          </div>
        )}
      </div>

      {/* ── Mobile: an icon, because the tab rail already scrolls and a field would crush it ── */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Search titles"
        className="flex h-8 w-8 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary sm:hidden"
      >
        <Search size={16} />
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-100 flex flex-col bg-surface-0 sm:hidden">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
            <SearchInput
              size="sm"
              containerClassName="flex-1"
              placeholder="Search titles…"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
            />
            <button
              type="button"
              onClick={() => { setSheetOpen(false); setQuery(""); }}
              aria-label="Close search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Results results={results} loading={isFetching} query={query} onPick={pick} />
          </div>
        </div>
      )}
    </>
  );
}
