"use client";

import Image from "next/image";

interface SimilarItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
}

interface Props {
  items: SimilarItem[];
}

export function MoreLikeThis({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-text-primary">More Like This</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.slice(0, 6).map((sim) => (
          <div key={sim.id} className="group cursor-pointer">
            <div className="relative aspect-2/3 overflow-hidden rounded-lg border border-border-subtle">
              <Image
                src={sim.poster_path ? `https://image.tmdb.org/t/p/w300${sim.poster_path}` : "/placeholder.svg"}
                alt={sim.title || sim.name || ""}
                fill
                sizes="15vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-snug text-text-secondary transition-colors group-hover:text-text-primary">
              {sim.title || sim.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
