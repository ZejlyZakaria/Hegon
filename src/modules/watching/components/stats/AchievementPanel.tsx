"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { ACHIEVEMENT_ICONS } from "@/shared/components/achievements/AchievementGrid";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import { cn } from "@/shared/utils/utils";
import type { StatsRawItem } from "@/modules/watching/service";
import type { DetailGroup, WatchingAchievement } from "./achievements";

/**
 * THE "WHY" — an achievement you can open.
 *
 * A badge that says "Unlocked" or "14 / 20" is a claim; this is the working. Which titles
 * counted (they open their fiche), how the number was reached, the day the bar was cleared, and —
 * for a locked one — what is still to go and what would count once finished. Read-only: nothing
 * here is a setting. Same door as the season panel: click the object, read it.
 *
 * Each SHAPE gets the layout its number deserves:
 *   count      → one flat list, 50 rows at a time (Cinephile is a few hundred films).
 *   sum / max  → a Top 10 ranking, the measure on the row itself (no title printed twice).
 *   distinct / max_group → the person-page TIMELINE: a rail, a dot per group, three rows and a
 *                "+N more" that opens the group in place.
 */

const PAGE = 50;
const GROUP_PAGE = 24;
const PEEK = 3;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const typeWord = (t: string) => (t === "film" ? "Film" : t === "serie" ? "Series" : "Anime");
const n = (v: number) => v.toLocaleString("en-GB");
/** "1 decade", "7 decades" — the units are all regular plurals. */
const qty = (v: number, unit: string) => `${n(v)} ${v === 1 ? unit.replace(/s$/, "") : unit}`;

function TitleRow({ item, measure, candidate }: { item: StatsRawItem; measure?: string; candidate?: boolean }) {
  return (
    <MediaRow
      href={`/perso/watching/${item.id}`}
      posterUrl={item.poster_url}
      title={item.title}
      meta={
        <span className="truncate text-micro text-text-tertiary">
          {/* A candidate's `watched_at` is its LAST sitting, not a finish — printing it under "would
              count once finished" reads as a finish date. Say what it is instead. */}
          {[typeWord(item.type), item.year, candidate ? "In progress" : item.watched_at ? fmtDate(item.watched_at) : null].filter(Boolean).join(" · ")}
          {/* The ranking's own figure, ON the row — the hours panel prints it on the right, but here
              the row IS the group and its label would have been the title a second time. */}
          {measure && <> · <span className="font-medium text-text-secondary">{measure}</span></>}
        </span>
      }
      right={item.user_rating != null ? <ScoreMark value={item.user_rating} source="mine" /> : undefined}
    />
  );
}

/** A quiet in-flow control: "+12 more", "Load more", "Show less". Text, not a button chrome. */
function More({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control px-2 py-1 text-micro font-medium text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
    >
      {children}
    </button>
  );
}

/** A flat list that grows 50 at a time — a library's worth of films should not mount at once. */
function PagedList({ items, unit }: { items: StatsRawItem[]; unit?: (i: StatsRawItem) => string }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);
  return (
    <>
      <ul>
        {shown.map((i) => <li key={i.id}><TitleRow item={i} measure={unit?.(i)} /></li>)}
      </ul>
      {items.length > limit && (
        <div className="pt-1">
          <More onClick={() => setLimit((l) => l + PAGE)}>
            Load more · {qty(items.length - limit, "titles")} left
          </More>
        </div>
      )}
    </>
  );
}

/**
 * One stop on the timeline — a decade, a genre, a director, a year, a month — with its count and
 * three of its titles. The rest opens in place; a closed group is a heading you can scan past.
 */
function TimelineGroup({ g, unit, color, last }: { g: DetailGroup; unit: string; color: string; last: boolean }) {
  // Opens in place, a page at a time — a 160-title decade is a library, not a footnote.
  const [limit, setLimit] = useState(PEEK);
  const shown = g.items.slice(0, limit);
  const hidden = g.items.length - shown.length;
  return (
    <div className={cn("relative pl-6", last ? "pb-0" : "pb-5")}>
      {/* Rail — runs through every group, stops at the last one. */}
      {!last && <span className="absolute left-[3px] top-2 h-full w-px bg-border-subtle" />}
      <span
        className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-surface-1"
        style={{ backgroundColor: color }}
      />
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="truncate text-xs font-bold tabular-nums text-text-primary">{g.label}</p>
        <p className="shrink-0 text-micro tabular-nums text-text-tertiary">{qty(g.value, unit)}</p>
      </div>
      <div className="-mx-2">
        {shown.map((i) => <TitleRow key={i.id} item={i} />)}
        {hidden > 0 && <More onClick={() => setLimit((l) => l + PAGE)}>+{n(hidden)} more</More>}
        {limit > PEEK && <More onClick={() => setLimit(PEEK)}>Show less</More>}
      </div>
    </div>
  );
}

function Timeline({ groups, unit, groupUnit, color }: { groups: DetailGroup[]; unit: string; groupUnit: string; color: string }) {
  const [limit, setLimit] = useState(GROUP_PAGE);
  const shown = groups.slice(0, limit);
  const left = groups.length - shown.length;
  return (
    <div>
      {shown.map((g, i) => (
        <TimelineGroup key={g.label} g={g} unit={groupUnit} color={color} last={i === shown.length - 1 && left === 0} />
      ))}
      {left > 0 && (
        <div className="pl-6 pt-1">
          <More onClick={() => setLimit((l) => l + GROUP_PAGE)}>Load more · {qty(left, unit)} left</More>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">{children}</h4>;
}

export function AchievementPanel({ a, open, onClose }: { a: WatchingAchievement | null; open: boolean; onClose: () => void }) {
  if (!a) return null;
  const Icon = ACHIEVEMENT_ICONS[a.icon];
  const c = a.color ?? "var(--color-accent-watching-vivid)";
  const d = a.detail;
  const pct = Math.round(a.progress * 100);
  const groupUnit = d.unit === "episodes" || d.unit === "hours" ? d.unit : "titles";
  // Per-row measure for the rankings: "312 h" under a title, "148 episodes" under a show.
  const measureOf = (g: DetailGroup) => (d.unit === "hours" ? `${n(g.value)} h` : `${n(g.value)} ${d.unit}`);

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      icon={<Icon size={15} style={{ color: a.unlocked ? c : "var(--color-text-tertiary)" }} />}
      title={a.name}
    >
      <div className="space-y-5 px-4 py-4">
        {/* ── The number, and where it stands against the bar ──
            The same box as the badge in the grid: the coloured inset ring is what "unlocked" looks
            like there, so it is what it looks like here. Locked wears the plain hairline. */}
        <div
          className={cn("rounded-card border bg-surface-1 p-4", a.unlocked ? "border-transparent" : "border-border-subtle")}
          style={a.unlocked ? { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 45%, transparent)` } : undefined}
        >
          <p className="text-xs text-text-secondary">{a.description}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums leading-none text-text-primary">{n(d.value)}</span>
            <span className="text-sm text-text-tertiary">/ {qty(d.goal, d.unit)}</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs">
            {a.unlocked ? (
              <>
                <Check size={13} style={{ color: c }} />
                <span className="font-medium text-text-primary">Unlocked</span>
                {d.unlockedAt && <span className="text-text-tertiary">· {fmtDate(d.unlockedAt)}</span>}
              </>
            ) : (
              <>
                <Lock size={12} className="text-text-tertiary" />
                <span className="text-text-secondary">{qty(d.remaining, d.unit)} to go</span>
                <span className="text-text-tertiary">· {pct}%</span>
              </>
            )}
          </p>
        </div>

        {/* ── How it is counted ── */}
        <p className="text-xs leading-relaxed text-text-secondary">{d.formula}</p>

        {/* ── Still to go — the carrot, when the rule can name one ──
            Its own box, not another heading over the same list: what WOULD count and what DID are
            two different facts, and they were reading as one ranking with a line through it. */}
        {!a.unlocked && d.candidates.length > 0 && (
          <section className="rounded-card border border-border-subtle bg-surface-1 p-2 pt-3">
            <div className="px-2"><SectionTitle>Would count once finished</SectionTitle></div>
            <ul>
              {d.candidates.slice(0, 8).map((i) => <li key={i.id}><TitleRow item={i} candidate /></li>)}
            </ul>
          </section>
        )}

        {/* ── The titles behind the number ── */}
        {d.groups.length > 0 && (d.shape === "count" ? (
          <section>
            <SectionTitle>Counted · {n(d.groups[0].items.length)}</SectionTitle>
            <PagedList items={d.groups[0].items} />
          </section>
        ) : d.shape === "sum" || d.shape === "max" ? (
          <section>
            <SectionTitle>Top {d.groups.length} · where it comes from</SectionTitle>
            <ul>
              {d.groups.map((g) => <li key={g.items[0].id}><TitleRow item={g.items[0]} measure={measureOf(g)} /></li>)}
            </ul>
          </section>
        ) : (
          <section>
            <SectionTitle>
              {d.shape === "distinct" ? `Where it comes from · ${n(d.groups.length)} ${d.unit}` : `Largest groups · top ${d.groups.length}`}
            </SectionTitle>
            <Timeline groups={d.groups} unit={d.shape === "distinct" ? d.unit : "groups"} groupUnit={groupUnit} color={c} />
          </section>
        ))}
      </div>
    </SlidingPanel>
  );
}
