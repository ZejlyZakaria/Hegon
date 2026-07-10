"use client";

import Link from "next/link";
import Image from "next/image";
import { Clapperboard, Sparkles, Star } from "lucide-react";

const TEAL = "var(--color-accent-watching-vivid)";
const AMBER = "#fbbf24";

export interface JourneyStats {
  owned: number;
  total: number;
  watchedCount: number;
  avgRating: number | null;
  top: { id: string; title: string; poster_url: string | null; user_rating: number | null; year: number | null } | null;
}

function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-control bg-white/10 p-3">
      <p className="text-caption uppercase tracking-wide text-white/45">{label}</p>
      <div className="mt-1 flex items-center gap-1 text-2xl font-bold tabular-nums text-white">{children}</div>
    </div>
  );
}

// The branded surface of the person page — pendant of the detail page's StatusCard
// (same teal-deep material, rail #1). Your relationship in two mini stats + your #1 +
// how far through their work you are. (No "hours" — undecidable across films/series.)
export function PersonJourney({ stats }: { stats: JourneyStats }) {
  const { owned, total, watchedCount, avgRating, top } = stats;
  const pct = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;

  return (
    <section
      className="rounded-card bg-accent-watching p-4"
      style={{
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.06), 0 2px 6px -2px rgba(0,0,0,0.5), 0 18px 44px -18px rgba(0,0,0,0.6)",
      }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-label font-medium text-white">
        <Sparkles size={11} /> Your journey
      </span>

      {owned === 0 ? (
        <p className="mt-3 text-label leading-relaxed text-white/60">
          Not in your collection yet — their work is below.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Watched">{watchedCount}</MiniStat>
            <MiniStat label="Avg rating">
              {avgRating != null ? (
                <>
                  <Star size={15} style={{ color: AMBER, fill: AMBER }} />
                  {avgRating.toFixed(1)}
                </>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </MiniStat>
          </div>

          {top && top.user_rating != null && (
            <>
              <div className="my-3 h-px bg-white/10" />
              <p className="text-caption uppercase tracking-wide text-white/45">Your #1</p>
              {/* Half-width cell, poster + title + rating·year below — like Stats Top Picks */}
              <Link href={`/perso/watching/${top.id}`} className="group -mx-1.5 mt-1 flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/5">
                <div className="relative h-14 w-9 shrink-0 overflow-hidden rounded-md bg-white/10">
                  {top.poster_url && <Image src={top.poster_url} alt="" fill unoptimized sizes="36px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-label font-medium text-white transition-colors group-hover:text-white/90">{top.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-0.5 text-caption font-semibold text-amber-300">
                      <Star size={9} style={{ color: AMBER, fill: AMBER }} /> {top.user_rating}
                    </span>
                    {top.year && <span className="text-caption text-white/45">{top.year}</span>}
                  </div>
                </div>
              </Link>
            </>
          )}

          <div className="my-3 h-px bg-white/10" />
          <div className="flex items-center justify-between text-label text-white/70">
            <span className="inline-flex items-center gap-1.5"><Clapperboard size={12} /> Filmography</span>
            <span className="tabular-nums text-white">{owned} / {total}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TEAL }} />
          </div>
        </>
      )}
    </section>
  );
}
