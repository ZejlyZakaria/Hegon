"use client";

import { BookOpen, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Book } from "../types";

const SKY = "#0ea5e9";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const router = useRouter();

  const progress =
    book.total_pages && book.current_page
      ? Math.round((book.current_page / book.total_pages) * 100)
      : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <button
      type="button"
      onClick={() => router.push(`/life/books/${book.id}`)}
      className="w-full cursor-pointer text-left p-3 bg-surface-1 hover:bg-surface-2 rounded-lg border border-border-subtle transition-colors duration-100"
    >
      <div className="flex gap-4">
        {/* Cover */}
        <div className="relative w-20 h-28 shrink-0 bg-surface-2 rounded overflow-hidden">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-text-tertiary" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {book.title}
          </h3>

          {book.author && (
            <p className="text-xs text-text-secondary truncate">{book.author}</p>
          )}

          <div className="mt-auto">
            {book.status === "reading" && book.total_pages && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>{book.current_page} / {book.total_pages} pages</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progress}%`, backgroundColor: SKY }}
                  />
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
                        className="w-3 h-3"
                        fill={i < book.rating! ? SKY : "none"}
                        stroke={i < book.rating! ? SKY : "#71717a"}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                )}
                {book.finished_at && (
                  <span className="text-xs text-text-tertiary">
                    Finished {formatDate(book.finished_at)}
                  </span>
                )}
              </div>
            )}

            {book.status === "want_to_read" && book.genre.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {book.genre.slice(0, 2).map((genre) => (
                  <span
                    key={genre}
                    className="text-xs text-text-tertiary bg-surface-2 px-2 py-0.5 rounded"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {(book.status === "paused" || book.status === "abandoned") && (
              <span className="text-xs text-text-tertiary capitalize">
                {book.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
