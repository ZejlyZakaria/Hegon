"use client";

import { BookOpen, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Book } from "../types";

const ACCENT = "var(--color-accent-books-vivid)";
const MUTED  = "var(--color-text-tertiary)";

// Info-rich horizontal card — used in the "Reading" view where progress matters.
// Content card → surface-card material (rim light + soft shadow), like Watching's
// My Take / Stats cards.
export function BookRow({ book }: { book: Book }) {
  const router = useRouter();

  const progress =
    book.total_pages && book.current_page
      ? Math.round((book.current_page / book.total_pages) * 100)
      : 0;

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <button
      type="button"
      onClick={() => router.push(`/life/books/${book.id}`)}
      className="surface-card w-full cursor-pointer rounded-card p-3 text-left transition-transform duration-200 ease-out hover:scale-[1.01]"
    >
      <div className="flex gap-4">
        {/* Cover */}
        <div className="relative aspect-2/3 w-(--poster-sm) shrink-0 overflow-hidden rounded-tile bg-surface-2">
          {book.cover_url ? (
            <Image src={book.cover_url} alt={book.title} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-5 w-5 text-text-tertiary" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">{book.title}</h3>
            {book.author && <p className="mt-0.5 truncate text-xs text-text-secondary">{book.author}</p>}
          </div>

          <div className="mt-auto">
            {book.status === "reading" && book.total_pages && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>{book.current_page} / {book.total_pages} pages</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: ACCENT }} />
                </div>
              </div>
            )}

            {book.status === "read" && (
              <div className="flex items-center gap-3">
                {book.rating && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3"
                        fill={i < book.rating! ? ACCENT : "none"}
                        stroke={i < book.rating! ? ACCENT : MUTED}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                )}
                {book.finished_at && (
                  <span className="text-xs text-text-tertiary">Finished {formatDate(book.finished_at)}</span>
                )}
              </div>
            )}

            {book.status === "want_to_read" && book.genre.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {book.genre.slice(0, 2).map((genre) => (
                  <span key={genre} className="rounded-chip bg-surface-2 px-2 py-0.5 text-xs text-text-tertiary">{genre}</span>
                ))}
              </div>
            )}

            {(book.status === "paused" || book.status === "abandoned") && (
              <span className="text-xs capitalize text-text-tertiary">{book.status}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
