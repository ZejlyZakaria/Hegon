"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarClock } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import type { PersonTitle } from "../../service";

const TEAL = "var(--color-accent-watching-vivid)";

interface Props {
  open: boolean;
  onClose: () => void;
  titles: PersonTitle[];
  firstName: string;
}

// Titles you actually engaged with — a want-to-watch has no place in a history.
export function timelineTitles(titles: PersonTitle[]): PersonTitle[] {
  return titles.filter((t) => t.watched || t.in_progress || t.paused || t.dropped);
}
export function datedCount(titles: PersonTitle[]): number {
  return timelineTitles(titles).filter((t) => !!t.watched_at).length;
}

function Entry({ t }: { t: PersonTitle }) {
  return (
    <Link
      href={`/perso/watching/${t.id}`}
      className="group flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-2"
    >
      <div className="relative aspect-2/3 w-(--poster-xs) shrink-0 overflow-hidden rounded-chip bg-surface-2 ring-1 ring-border-subtle">
        {t.poster_url && (
          <Image src={t.poster_url} alt="" fill unoptimized loading="lazy" sizes="32px" className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text-primary transition-colors group-hover:text-accent-watching-vivid">
          {t.title}
        </p>
        {t.role && <p className="truncate text-micro text-text-tertiary">{t.role}</p>}
      </div>
      {/* YOUR rating → the shared mark, in teal. It wore a GOLD star, i.e. the world's colour
          on a number only you wrote — the same lie the carousel and the person grid told. */}
      {t.user_rating != null && (
        <ScoreMark value={t.user_rating} source="mine" className="shrink-0" />
      )}
    </Link>
  );
}

// The story of your relationship, year by year — the shape the wide grid can't hold.
// Most recent first: your relationship as it stands today, read backwards.
export function PersonTimelinePanel({ open, onClose, titles, firstName }: Props) {
  const rows = timelineTitles(titles);
  const dated = rows.filter((t) => t.watched_at);
  const undated = rows.filter((t) => !t.watched_at);

  const byYear = new Map<number, PersonTitle[]>();
  for (const t of dated) {
    const y = Number(t.watched_at!.slice(0, 4));
    if (!Number.isFinite(y)) continue;
    byYear.set(y, [...(byYear.get(y) ?? []), t]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  for (const y of years) {
    byYear.get(y)!.sort((a, b) => (b.watched_at ?? "").localeCompare(a.watched_at ?? ""));
  }

  const first = years.length ? years[years.length - 1] : null;
  const span = first ? new Date().getFullYear() - first + 1 : 0;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      icon={<CalendarClock size={15} className="text-accent-watching-vivid" />}
      title={`Your timeline with ${firstName}`}
    >
      <div className="px-4 py-4">
        {first && (
          <p className="mb-5 text-xs text-text-tertiary">
            Since <span className="font-semibold text-text-secondary">{first}</span> ·{" "}
            {span} {span > 1 ? "years" : "year"} together
          </p>
        )}

        {years.map((year) => (
          <div key={year} className="relative pb-5 pl-6 last:pb-0">
            {/* Rail — runs through every group, stops at the last one. */}
            <span className="absolute left-[3px] top-2 h-full w-px bg-border-subtle" />
            <span
              className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-surface-1"
              style={{ backgroundColor: TEAL }}
            />
            <p className="mb-1.5 text-xs font-bold tabular-nums text-text-primary">{year}</p>
            <div className="-mx-2">
              {byYear.get(year)!.map((t) => (
                <Entry key={t.id} t={t} />
              ))}
            </div>
          </div>
        ))}

        {undated.length > 0 && (
          <div className="relative pl-6">
            <span className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full bg-border-strong ring-2 ring-surface-1" />
            <p className="mb-1.5 text-xs font-bold text-text-tertiary">Undated</p>
            <div className="-mx-2">
              {undated.map((t) => (
                <Entry key={t.id} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </SlidingPanel>
  );
}
