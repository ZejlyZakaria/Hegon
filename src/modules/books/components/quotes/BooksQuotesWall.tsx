"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Quote, Search, Heart, BookOpen } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { useAllQuotes, useToggleQuoteFavorite } from "../../hooks/useBookQuotes";
import type { QuoteWithBook } from "../../types";

const ACCENT = "var(--color-accent-books-vivid)";

export function BooksQuotesWall() {
  const router = useRouter();
  const { data: quotes = [], isLoading } = useAllQuotes();
  const toggleFav = useToggleQuoteFavorite();
  const [search, setSearch]   = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = quotes;
    if (favOnly) list = list.filter((q) => q.favorite);
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (q) =>
          q.text.toLowerCase().includes(s) ||
          q.book_title.toLowerCase().includes(s) ||
          (q.book_author ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [quotes, search, favOnly]);

  if (isLoading) {
    return (
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-4 h-40 break-inside-avoid animate-pulse rounded-xl bg-surface-1" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Quote size={32} className="text-text-tertiary/40" />
        <p className="text-sm text-text-secondary">No quotes yet</p>
        <p className="max-w-xs text-xs text-text-tertiary">
          Capture the lines that stay with you from a book&apos;s page — they all collect here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex flex-1 items-center sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 text-text-tertiary" />
          <Input
            variant="tasks"
            type="text"
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full py-0 pl-8 text-xs bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus"
          />
        </div>
        <button
          type="button"
          onClick={() => setFavOnly((v) => !v)}
          title={favOnly ? "Show all" : "Show favorites only"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
            favOnly
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : "border-border-subtle bg-surface-1 text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
          }`}
        >
          <Heart size={14} className={favOnly ? "fill-red-400" : ""} />
        </button>
        <span className="ml-auto text-xs text-text-tertiary tabular-nums">{filtered.length}</span>
      </div>

      {/* Masonry wall */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-xs text-text-tertiary">
          {favOnly ? "No favorite quotes yet." : "No quotes match your search."}
        </p>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {filtered.map((q) => (
            <QuoteCard key={q.id} quote={q} onOpen={() => router.push(`/life/books/${q.book_id}`)} onToggleFav={() => toggleFav.mutate({ id: q.id, favorite: !q.favorite, bookId: q.book_id })} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ quote, onOpen, onToggleFav }: {
  quote: QuoteWithBook;
  onOpen: () => void;
  onToggleFav: () => void;
}) {
  return (
    <div className="group mb-4 break-inside-avoid surface-card rounded-xl p-5">
      <Quote size={18} style={{ color: ACCENT }} className="mb-2 opacity-60" />

      <p className="text-sm leading-relaxed text-text-primary">{quote.text}</p>

      {quote.note && (
        <p className="mt-2 text-xs italic leading-snug text-text-tertiary">{quote.note}</p>
      )}

      <div className="mt-4 flex items-center gap-2.5 border-t border-border-subtle pt-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-surface-2">
            {quote.book_cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={quote.book_cover} alt={quote.book_title} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><BookOpen size={11} className="text-text-tertiary" /></div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">{quote.book_title}</p>
            <p className="truncate text-[11px] text-text-tertiary">
              {quote.book_author ?? "Unknown"}{quote.page != null ? ` · p.${quote.page}` : ""}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleFav}
          title={quote.favorite ? "Unfavorite" : "Favorite"}
          className="shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-2"
        >
          <Heart size={13} className={quote.favorite ? "fill-red-500 text-red-500" : ""} />
        </button>
      </div>
    </div>
  );
}
