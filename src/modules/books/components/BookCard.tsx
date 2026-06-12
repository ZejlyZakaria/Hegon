"use client";

import { BookOpen, Heart, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Book } from "../types";

const ACCENT = "var(--color-accent-books-vivid)";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/life/books/${book.id}`)}
      className="group block w-full cursor-pointer text-left"
    >
      {/* Cover */}
      <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-surface-1 transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
        {book.cover_url ? (
          <Image src={book.cover_url} alt={book.title} fill sizes="160px" className="object-cover" />
        ) : (
          /* Generated cover for books without an image — keeps the shelf coherent */
          <div className="flex h-full w-full flex-col justify-between bg-linear-to-br from-surface-2 to-surface-1 p-2.5">
            <BookOpen size={12} className="text-text-tertiary/30" />
            <div>
              <p className="line-clamp-4 text-[11px] font-semibold leading-snug text-text-secondary">{book.title}</p>
              {book.author && <p className="mt-1 line-clamp-1 text-[9px] text-text-tertiary">{book.author}</p>}
            </div>
          </div>
        )}

        {/* Favorite — top-left */}
        {book.favorite && (
          <div className="absolute left-2.5 top-2.5">
            <Heart size={12} className="fill-red-500 text-red-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
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
  );
}
