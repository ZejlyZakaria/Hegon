"use client";

import { BookOpen, Heart, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils/utils";
import { useToggleFavorite } from "../hooks/useBooks";
import type { Book } from "../types";

const ACCENT = "var(--color-accent-books-vivid)";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const router = useRouter();
  const toggleFav = useToggleFavorite();
  const open = () => router.push(`/life/books/${book.id}`);

  // Wrapper is non-interactive; the cover (navigation) and the heart (toggle) are
  // sibling buttons so we never nest interactive controls.
  return (
    <div className="group relative w-full text-left">
      {/* Cover — navigation */}
      <button
        type="button"
        onClick={open}
        className="block w-full cursor-pointer text-left"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-tile bg-surface-1 transition-transform duration-300 ease-out group-hover:scale-[1.04]">
          {book.cover_url ? (
            <Image src={book.cover_url} alt={book.title} fill sizes="160px" className="object-cover" />
          ) : (
            /* Simple placeholder for books without a cover — title/author show below */
            <div className="flex h-full w-full items-center justify-center bg-surface-2">
              <BookOpen size={22} className="text-text-tertiary/40" />
            </div>
          )}

          {/* Status badge — top-right, frosted pill */}
          {book.status === "reading" && (
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 ring-1 ring-white/15 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
              <span className="text-[9px] font-semibold text-white">Reading</span>
            </div>
          )}
          {book.status === "read" && book.rating != null && (
            <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-full bg-black/55 px-2 py-0.5 ring-1 ring-white/15 backdrop-blur-md">
              <Star size={9} className="fill-amber-400 text-amber-400" />
              <span className="text-[9px] font-semibold text-white">{book.rating}</span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-1 text-xs font-medium text-text-primary">{book.title}</h3>
          {book.author && <p className="mt-0.5 line-clamp-1 text-[10px] text-text-tertiary">{book.author}</p>}
        </div>
      </button>

      {/* Favorite — top-left toggle (sibling of the cover button) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggleFav.mutate({ id: book.id, favorite: !book.favorite }); }}
        title={book.favorite ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          "absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full transition-opacity",
          book.favorite
            ? "opacity-100"
            : "bg-black/45 opacity-0 ring-1 ring-white/15 backdrop-blur-md group-hover:opacity-100",
        )}
      >
        <Heart
          size={12}
          className={book.favorite
            ? "fill-red-500 text-red-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            : "text-white"}
        />
      </button>
    </div>
  );
}
