"use client";

import { useRouter } from "next/navigation";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { MediaRow } from "../shared/MediaRow";
import { displayTitle } from "../../utils";
import type { ComputedStats, HoursEntry, RewatchEntry } from "./computeStats";

/**
 * WHERE THE HOURS WENT — the working behind one slice of the donut.
 *
 * A total is a claim you have to take on faith. `Elite` was billed zero hours for two days and the
 * only way to notice was to feel that a number looked small, because nothing on the page could be
 * opened. So this panel's job is not to list titles: it is to make the figure ADD UP in front of
 * you. Hence the arithmetic on every row, and hence the block at the bottom — the titles worth
 * nothing are the ones a sum hides best, and they are the ones worth seeing.
 */

export type SliceKey = "film" | "serie" | "anime" | "rewatches";

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The right-hand column: what this title contributed, and what fraction of the slice that is.
 *
 * There was a proportion bar here first, and it did not earn its place: under two lines of text it
 * read as an underline on every row, and once the rows are already ranked and their figures are
 * right-aligned and tabular, the eye has everything it needs. A PERCENTAGE says the same thing in
 * four characters and answers a question the ordering cannot — "is this half of my year, or 4% of
 * it?". So the measure stays and the graphic goes.
 */
function Contribution({ minutes, total }: { minutes: number; total: number }) {
  const pct = total > 0 ? (minutes / total) * 100 : 0;
  return (
    <div className="text-right">
      <p className="text-xs font-medium tabular-nums text-text-primary">{fmt(minutes)}</p>
      <p className="mt-0.5 text-micro tabular-nums text-text-tertiary">
        {pct > 0 && pct < 1 ? "<1" : Math.round(pct)}%
      </p>
    </div>
  );
}

export function HoursBreakdownPanel({
  slice,
  onClose,
  stats,
  year,
  color,
  label,
}: {
  /** null = closed. */
  slice: SliceKey | null;
  onClose: () => void;
  stats: ComputedStats;
  year: number | null;
  color: string;
  label: string;
}) {
  const router = useRouter();
  const open = slice !== null;
  const period = year ? String(year) : "All time";

  const open_ = (id: string) => { onClose(); router.push(`/perso/watching/${id}`); };

  // Rewatches are events, everything else is an aggregate. Split here rather than pretending one
  // row grammar fits both: a rewatch has a date, a series has a calculation.
  const isRewatch = slice === "rewatches";
  const entries: HoursEntry[] = !slice || isRewatch ? [] : stats.breakdown[slice];
  const events: RewatchEntry[] = isRewatch ? stats.breakdown.rewatches : [];

  const counted = entries.filter((e) => e.minutes > 0);
  const unknown = entries.filter((e) => e.minutes === 0);
  const totalMin = slice ? Math.round((isRewatch ? stats.hours.rewatches : stats.hours[slice]) * 60) : 0;
  const count = isRewatch ? events.length : entries.length;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      width="wide"
      title={
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="truncate text-sm font-semibold text-text-primary">{label}</h2>
          </div>
          {/* The header states the period out loud. A breakdown that silently spans a different
              range than the donut is worse than no breakdown: the sum stops matching and you lose
              trust in both numbers. */}
          <p className="mt-0.5 text-micro tabular-nums text-text-tertiary">
            {fmt(totalMin)} · {period} · {count} {isRewatch ? (count === 1 ? "rewatch" : "rewatches") : count === 1 ? "title" : "titles"}
          </p>
        </div>
      }
    >
      <div className="space-y-1 px-4 py-4">
        {isRewatch
          ? events.map((e, i) => (
              <MediaRow
                key={`${e.item.id}-${e.watchedOn}-${i}`}
                posterUrl={e.item.poster_url}
                title={displayTitle(e.item)}
                onClick={() => open_(e.item.id)}
                meta={
                  <span className="text-micro text-text-tertiary">
                    Rewatched {DATE_FMT.format(new Date(e.watchedOn))}
                  </span>
                }
                right={<Contribution minutes={e.minutes} total={totalMin} />}
              />
            ))
          : counted.map((e) => (
              <MediaRow
                key={e.item.id}
                // The season's own cover when the year resolves to one season — a year of Jujutsu
                // Kaisen is a cour, and it has its own artwork.
                posterUrl={e.seasonPoster ?? e.item.poster_url}
                title={displayTitle(e.item)}
                onClick={() => open_(e.item.id)}
                meta={
                  <>
                    {e.seasonLabel && (
                      <span className="shrink-0 text-micro font-medium" style={{ color }}>
                        {e.seasonLabel}
                      </span>
                    )}
                    {/* A FILM'S ARITHMETIC IS ITS TOTAL. Printing "120 min" here next to "2h" on the
                        right was the same fact twice, in two formats, which reads as two facts. */}
                    {e.item.type !== "film" && (
                      <span className="text-micro tabular-nums text-text-tertiary">
                        {e.episodes} ep × {e.runtime} min
                      </span>
                    )}
                  </>
                }
                right={<Contribution minutes={e.minutes} total={totalMin} />}
              />
            ))}

        {/* THE DIAGNOSTIC. Below a rule, not mixed into the ranking: a title worth zero is not the
            smallest contributor, it is a missing fact. Mixed in, it reads as "barely watched";
            separated, it reads as "we don't know how long this is", which is the truth. */}
        {unknown.length > 0 && (
          <div className="space-y-1 border-t border-border-subtle pt-4">
            <p className="text-micro text-text-tertiary">
              {unknown.length} {unknown.length === 1 ? "title has" : "titles have"} no known runtime — counted as zero
            </p>
            {unknown.map((e) => (
              <MediaRow
                key={e.item.id}
                posterUrl={e.seasonPoster ?? e.item.poster_url}
                title={displayTitle(e.item)}
                onClick={() => open_(e.item.id)}
                className="opacity-60"
                meta={
                  <span className="text-micro text-text-tertiary">
                    {e.item.type === "film" ? "Runtime unknown" : `${e.episodes} ep · runtime unknown`}
                  </span>
                }
                right={<span className="text-xs tabular-nums text-text-tertiary">—</span>}
              />
            ))}
          </div>
        )}
      </div>
    </SlidingPanel>
  );
}
