"use client";

import { Check, Lock } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { ACHIEVEMENT_ICONS } from "@/shared/components/achievements/AchievementGrid";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import type { StatsRawItem } from "@/modules/watching/service";
import type { DetailGroup, WatchingAchievement } from "./achievements";

/**
 * THE "WHY" — an achievement you can open.
 *
 * A badge that says "Unlocked" or "14 / 20" is a claim; this is the working. Which titles
 * counted (they open their fiche), how the number was reached, the day the bar was cleared, and —
 * for a locked one — what is still to go and what would count once finished. Read-only: nothing
 * here is a setting. Same door as the season panel: click the object, read it.
 */

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const typeWord = (t: string) => (t === "film" ? "Film" : t === "serie" ? "Series" : "Anime");

function TitleRow({ item, right }: { item: StatsRawItem; right?: React.ReactNode }) {
  return (
    <MediaRow
      href={`/perso/watching/${item.id}`}
      posterUrl={item.poster_url}
      title={item.title}
      meta={
        <span className="truncate text-micro text-text-tertiary">
          {[typeWord(item.type), item.year, item.watched_at ? fmtDate(item.watched_at) : null].filter(Boolean).join(" · ")}
        </span>
      }
      right={right ?? (item.user_rating != null ? <ScoreMark value={item.user_rating} source="mine" /> : undefined)}
    />
  );
}

/** A group of titles under its label — a decade, a director, a year — with its own count. */
function Group({ g, unit, open }: { g: DetailGroup; unit: string; open: boolean }) {
  const shown = open ? g.items : g.items.slice(0, 3);
  return (
    <div>
      <div className="flex items-baseline justify-between px-2 pb-1">
        <p className="text-xs font-semibold text-text-primary">{g.label}</p>
        <p className="text-micro tabular-nums text-text-tertiary">{g.value} {unit}</p>
      </div>
      <ul>
        {shown.map((i) => <li key={i.id}><TitleRow item={i} /></li>)}
      </ul>
      {!open && g.items.length > 3 && (
        <p className="px-2 pt-1 text-micro text-text-tertiary">and {g.items.length - 3} more</p>
      )}
    </div>
  );
}

export function AchievementPanel({ a, open, onClose }: { a: WatchingAchievement | null; open: boolean; onClose: () => void }) {
  if (!a) return null;
  const Icon = ACHIEVEMENT_ICONS[a.icon];
  const c = a.color ?? "var(--color-accent-watching-vivid)";
  const d = a.detail;
  const pct = Math.round(a.progress * 100);
  // Distinct/max_group rules produce many small groups: only the first is opened in full.
  const manyGroups = d.groups.length > 1;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      icon={<Icon size={15} style={{ color: a.unlocked ? c : "var(--color-text-tertiary)" }} />}
      title={a.name}
    >
      <div className="space-y-5 px-4 py-4">
        {/* ── The number, and where it stands against the bar ── */}
        <div className="surface-card rounded-card p-4">
          <p className="text-xs text-text-secondary">{a.description}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums leading-none text-text-primary">{d.value.toLocaleString("en-GB")}</span>
            <span className="text-sm text-text-tertiary">/ {d.goal.toLocaleString("en-GB")} {d.unit}</span>
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
                <span className="text-text-secondary">{d.remaining.toLocaleString("en-GB")} {d.unit} to go</span>
                <span className="text-text-tertiary">· {pct}%</span>
              </>
            )}
          </p>
        </div>

        {/* ── How it is counted ── */}
        <p className="text-xs leading-relaxed text-text-secondary">{d.formula}</p>

        {/* ── Still to go — the carrot, when the rule can name one ── */}
        {!a.unlocked && d.candidates.length > 0 && (
          <section>
            <h4 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">Would count once finished</h4>
            <ul>
              {d.candidates.slice(0, 8).map((i) => <li key={i.id}><TitleRow item={i} /></li>)}
            </ul>
          </section>
        )}

        {/* ── The titles behind the number ── */}
        {d.groups.length > 0 && (
          <section>
            <h4 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
              {manyGroups ? "Where it comes from" : "Counted"}
            </h4>
            {manyGroups ? (
              <div className="space-y-4">
                {d.groups.map((g, i) => <Group key={g.label} g={g} unit={d.unit === "episodes" || d.unit === "hours" ? d.unit : "titles"} open={i === 0} />)}
              </div>
            ) : (
              <ul>
                {d.groups[0].items.map((i) => <li key={i.id}><TitleRow item={i} /></li>)}
              </ul>
            )}
          </section>
        )}
      </div>
    </SlidingPanel>
  );
}
