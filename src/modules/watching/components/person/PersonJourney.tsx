"use client";

import { Clapperboard, Sparkles, Star, Trophy } from "lucide-react";

const TEAL = "var(--color-accent-watching-vivid)";
const AMBER = "var(--color-gold)";

export interface JourneyStats {
  owned: number;       // in your library, any status — gates the empty state
  total: number;
  watchedCount: number;
  avgRating: number | null;
  topTen: number;      // how many of your Top 10s (one per type) are theirs
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
// (same teal-deep material, rail #1). Your relationship in two mini stats + how far
// through their work you are. (No "hours" — undecidable across films/series.)
export function PersonJourney({ stats }: { stats: JourneyStats }) {
  const { owned, total, watchedCount, avgRating, topTen } = stats;
  // Progress through their work = what you've SEEN. A want-to-watch filling a completion
  // bar is a lie — it stays in the grid with its badge, not here.
  const pct = total > 0 ? Math.min(100, Math.round((watchedCount / total) * 100)) : 0;

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
                  {/* The average of YOUR scores → teal. It wore the gold star, which is the
                      world's colour — the mark said "TMDB" about a number only you wrote. */}
                  <Star size={15} style={{ color: TEAL, fill: TEAL }} />
                  {avgRating.toFixed(1)}
                </>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </MiniStat>
          </div>

          {topTen > 0 && (
            <>
              <div className="my-3 h-px bg-white/10" />
              <p className="flex items-center gap-1.5 text-label text-white/70">
                <Trophy size={12} style={{ color: AMBER }} />
                <span>
                  <span className="font-semibold text-white">{topTen}</span> of your Top 10{" "}
                  {topTen > 1 ? "are" : "is"} theirs
                </span>
              </p>
            </>
          )}

          <div className="my-3 h-px bg-white/10" />
          <div className="flex items-center justify-between text-label text-white/70">
            <span className="inline-flex items-center gap-1.5"><Clapperboard size={12} /> Filmography</span>
            <span className="tabular-nums text-white">{watchedCount} / {total}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TEAL }} />
          </div>
        </>
      )}
    </section>
  );
}
