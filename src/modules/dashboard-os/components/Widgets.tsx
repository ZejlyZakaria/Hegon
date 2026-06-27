"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Play, PenLine, BookOpen, Repeat2, Flame } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useDashboardData } from "@/modules/dashboard/hooks/useDashboardData";
import { useUpcomingEvents } from "@/modules/journal/hooks/useJournalEvents";
import { useJournalToday } from "@/modules/journal/hooks/useJournalToday";
import { useHabitsToday } from "@/modules/habits/hooks/useHabitsToday";
import { useBooks } from "@/modules/books/hooks/useBooks";
import { MOOD_CONFIG } from "@/modules/journal/types";
import type { DashboardMedia } from "@/modules/dashboard/types";
import { OS_APPS } from "../config";
import { WidgetShell } from "./WidgetShell";

// Glass rim shared by image-led tiles (matches the weather widgets).
const GLASS_RIM = {
  boxShadow:
    "inset 0 1px 0 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 34px -10px rgba(0,0,0,0.6)",
} as const;

const PARIS_TZ = "Europe/Paris";

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
}
function relDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Row({ color, title, meta }: { color: string; title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 truncate text-[12px] text-white/90">{title}</span>
      {meta && <span className="shrink-0 text-[10px] text-white/45">{meta}</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11px] italic text-white/35">{text}</p>;
}

// ─── Weather ────────────────────────────────────────────────────────────────
// S + M live in ./weather (animated sky engine driven by real sunrise/sunset).
// Re-exported here so the home composition imports every widget from one place.
export { WeatherWidget, WeatherWidgetM } from "./weather/WeatherWidgets";

// ─── Daily score ──────────────────────────────────────────────────────────────

// ─── Events (journal events + sport) ──────────────────────────────────────────

// Journal events / reminders only (sport lives in the Sport widget now — one
// domain per widget).
export function EventsWidget() {
  const { data: events = [] } = useUpcomingEvents(3);
  const rows = events.slice(0, 3);

  return (
    <WidgetShell size="m" title="Events" accent="#f97316">
      {rows.length === 0 ? (
        <Empty text="Nothing coming up." />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((e) => (
            <Row key={e.id} color="#f97316" title={e.title} meta={relDate(e.event_date)} />
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

// ─── Now watching ─────────────────────────────────────────────────────────────

function episodeLabel(m: DashboardMedia): string | null {
  if ((m.type === "serie" || m.type === "anime") && m.current_season && m.current_episode)
    return `S${String(m.current_season).padStart(2, "0")} · E${String(m.current_episode).padStart(2, "0")}`;
  return null;
}
function episodeProgress(m: DashboardMedia): number | null {
  if (!m.current_episode || !m.current_season || !m.season_episodes) return null;
  const total = m.season_episodes.reduce((s, n) => s + n, 0);
  if (total === 0) return null;
  const prev = m.season_episodes.slice(0, m.current_season - 1).reduce((s, n) => s + n, 0);
  return Math.round(((prev + m.current_episode) / total) * 100);
}

function typeLabel(m: DashboardMedia): string {
  return m.type === "anime" ? "Anime" : m.type === "serie" ? "Series" : "Film";
}

export function NowWatchingWidget() {
  const { data } = useDashboardData();
  const list = data?.inProgressMediaList ?? [];
  const media =
    list.find((m) => m.type === "serie" || m.type === "anime") ??
    list[0] ??
    null;
  const progress = media ? episodeProgress(media) : null;
  const img = media?.backdrop_url ?? media?.poster_url ?? null;
  const teal = "var(--color-accent-watching-vivid)";
  // other in-progress titles, for the "+N more" stack hint
  const others = media ? list.filter((m) => m.id !== media.id).length : 0;

  if (!media) {
    return (
      <div className="glass-panel flex h-full w-full items-center justify-center rounded-[22px]">
        <p className="text-[11px] italic text-white/40">Nothing in progress.</p>
      </div>
    );
  }

  const chip = episodeLabel(media) ?? typeLabel(media);

  return (
    <Link
      href={`/perso/watching/${media.id}`}
      className="group relative block h-full w-full overflow-hidden rounded-[22px]"
      style={GLASS_RIM}
    >
      {img ? (
        <Image
          src={img}
          alt={media.title}
          fill
          sizes="360px"
          unoptimized
          className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.06]"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(155deg,#2dd4bf,#0c3d4a)" }} />
      )}

      {/* cinematic scrims — bottom lift + left wash → text lives lower-left like a poster */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.08) 58%, transparent)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.55), transparent 60%)" }} />
      {/* teal cast on hover — the title breathes its module color */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(120% 80% at 0% 100%, rgba(45,212,191,0.22), transparent 60%)" }}
      />

      {/* eyebrow */}
      <div className="absolute left-3.5 top-3 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_8px_var(--color-accent-watching-vivid)]" style={{ background: teal }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 drop-shadow">Now watching</span>
      </div>

      {/* resume affordance — glass play that wakes on hover (tap → open) */}
      <div className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
        <Play size={13} className="ml-0.5 fill-white text-white" />
      </div>

      {/* +N more watching — sits under the eyebrow, never collides with the progress row */}
      {others > 0 && (
        <span className="absolute left-3.5 top-7.5 text-[10px] font-medium tabular-nums text-white/55 drop-shadow">
          +{others} more in progress
        </span>
      )}

      {/* bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-3.5">
        <p className="line-clamp-2 max-w-[78%] text-[15px] font-semibold leading-[1.15] text-white drop-shadow-md">
          {media.title}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 rounded-full border border-white/15 bg-white/12 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur-sm">
            {chip}
          </span>
          {progress !== null && (
            <>
              <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, background: teal, boxShadow: `0 0 8px ${"var(--color-accent-watching-vivid)"}` }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/75">{progress}%</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Today (priority tasks + streak) ──────────────────────────────────────────

// Read-only headline list (Reminders look). The dashboard never mutates — a tap
// opens Tasks, where the real multi-status kanban workflow lives. The dot shows
// priority; no checkbox (a binary check would lie about the per-project statuses).
const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#52525b",
};

function taskTime(dueDate: string): string | null {
  const t = new Date(dueDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: PARIS_TZ });
  return t === "00:00" ? null : t;
}

export function TodayWidget() {
  const { data } = useDashboardData();
  const today = todayStr();

  const tasks = (data?.tasks ?? [])
    .filter((t) => t.due_date && t.due_date.slice(0, 10) <= today)
    .sort((a, b) => {
      const pa = ["critical", "high", "medium", "low"].indexOf(a.priority);
      const pb = ["critical", "high", "medium", "low"].indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
    });

  const shown = tasks.slice(0, 3);

  return (
    <Link href="/pro/tasks" className="glass-panel relative flex h-full w-full flex-col overflow-hidden rounded-[22px] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white/80">Today</span>
        {tasks.length > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/12 px-1.5 text-[11px] font-semibold tabular-nums text-white/70">
            {tasks.length}
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/15">
            <Check size={15} strokeWidth={2.5} className="text-emerald-400" />
          </div>
          <p className="text-[11px] text-white/45">All clear today</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {shown.map((t) => {
            const overdue = t.due_date!.slice(0, 10) < today;
            const time = taskTime(t.due_date!);
            return (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_DOT[t.priority] ?? "#52525b" }} />
                <span className="flex-1 truncate text-[13px] text-white/90">{t.title}</span>
                <span className={cn("shrink-0 text-[11px] tabular-nums", overdue ? "text-red-400/80" : "text-white/45")}>
                  {overdue ? "Overdue" : (time ?? t.project_name)}
                </span>
              </div>
            );
          })}
          {tasks.length > 3 && <span className="text-[10px] text-white/40">+{tasks.length - 3} more</span>}
        </div>
      )}
    </Link>
  );
}

// ─── shared bits for the solid-accent stat tiles ─────────────────────────────
// The Apple-kit move: each widget paints its module's gloss gradient (the same
// vivid→deep from the app icon), with high-contrast white content on top.

// Solid tile shell — module gloss bg + top sheen + subtle hover lift.
function SolidTile({
  href, appKey, children,
}: { href: string; appKey: keyof typeof OS_APPS; children: React.ReactNode }) {
  const { from, to } = OS_APPS[appKey];
  return (
    <Link
      href={href}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-[22px] p-4 transition-transform duration-300 active:scale-[0.98]"
      style={{ backgroundImage: `linear-gradient(155deg, ${from}, ${to})`, ...GLASS_RIM }}
    >
      {/* top sheen — the iOS app-icon gloss */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.16), transparent)" }} />
      <div className="relative flex h-full w-full flex-col">{children}</div>
    </Link>
  );
}

// Label row for a solid tile (white, uppercase) with optional right slot.
function TileLabel({ icon: Icon, label, right }: { icon: typeof Check; label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-white/90" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/90">{label}</span>
      </div>
      {right}
    </div>
  );
}

// Progress ring — dark track on the solid bg, bright white arc.
function Ring({
  value, size = 50, stroke = 6, children,
}: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c * (1 - pct / 100);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// ─── Habits — Daily-Goal style (S, solid violet) ──────────────────────────────
// Label + big X/Y headline + a centered ring with a check at its core. No streak.
export function HabitsWidget() {
  const { habits, completedCount, totalCount } = useHabitsToday();
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const empty = totalCount === 0 && habits.length === 0;

  return (
    <SolidTile href="/life/habits" appKey="habits">
      <TileLabel icon={Repeat2} label="Habits" />
      {empty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[11px] italic text-white/60">No habits today.</p>
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-[32px] font-medium leading-none tabular-nums text-white">
            {completedCount}<span className="text-white/50">/{totalCount}</span>
          </p>
          <div className="mt-auto flex justify-start pb-0.5">
            <Ring value={pct} size={58} stroke={7}>
              <Flame
                size={18}
                strokeWidth={2.25}
                className={allDone ? "fill-orange-400 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]" : "text-white/35"}
              />
            </Ring>
          </div>
        </>
      )}
    </SolidTile>
  );
}

// ─── Books — typographic now-reading (S, solid blue) ──────────────────────────
// A square can't hold a portrait cover, so the TITLE becomes the art: large,
// bold, editorial. Author + a full-width progress liseré ground it.
export function BooksWidget() {
  const { data: books = [] } = useBooks({ status: "reading" });
  const book = [...books].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
  const progress =
    book && book.total_pages && book.total_pages > 0
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : null;

  if (!book) {
    return (
      <SolidTile href="/life/books" appKey="books">
        <TileLabel icon={BookOpen} label="Reading" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[11px] italic text-white/60">Not reading.</p>
        </div>
      </SolidTile>
    );
  }

  return (
    <SolidTile href="/life/books" appKey="books">
      <TileLabel icon={BookOpen} label="Reading" right={progress !== null ? <span className="text-[11px] font-bold tabular-nums text-white/90">{progress}%</span> : undefined} />

      <p className="mt-2 line-clamp-3 text-[16px] font-bold leading-[1.12] tracking-tight text-white">
        {book.title}
      </p>

      <div className="mt-auto">
        {book.author && <p className="mb-1.5 truncate text-[11px] text-white/65">{book.author}</p>}
        {progress !== null ? (
          <div className="h-0.75 w-full overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%`, transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)" }} />
          </div>
        ) : (
          book.total_pages && <p className="text-[10px] tabular-nums text-white/55">{book.total_pages} pages</p>
        )}
      </div>
    </SolidTile>
  );
}

// ─── Journal — today (S, solid orange) ────────────────────────────────────────
// Same content as before (kept on owner's request) — only the surface is now the
// module gloss instead of glass.
export function JournalWidget() {
  const { data: entry } = useJournalToday();
  const mood = entry?.mood ? MOOD_CONFIG[entry.mood] : null;
  const preview = entry?.content?.trim().split("\n")[0] ?? "";

  return (
    <SolidTile href="/life/journal" appKey="journal">
      <TileLabel icon={PenLine} label="Journal" />

      {entry ? (
        <div className="mt-auto flex flex-col gap-2">
          {mood && (
            <div className="flex items-center gap-2">
              <span
                className="h-5 w-5 rounded-full ring-1 ring-white/40"
                style={{ background: `radial-gradient(circle at 35% 30%, ${mood.color}, ${mood.color}88 60%, ${mood.color}44)` }}
              />
              <span className="text-[12px] font-semibold text-white">{mood.label}</span>
            </div>
          )}
          <p className="line-clamp-2 text-[11px] leading-snug text-white/75">
            {preview || `${entry.word_count} words today`}
          </p>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-2">
          <span className="h-5 w-5 rounded-full border border-dashed border-white/45" />
          <div>
            <p className="text-[13px] font-semibold text-white">How was today?</p>
            <p className="mt-0.5 text-[10.5px] text-white/70">Tap to write</p>
          </div>
        </div>
      )}
    </SolidTile>
  );
}
