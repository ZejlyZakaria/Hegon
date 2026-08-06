"use client";

import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Clock, Ticket } from "lucide-react";
import type { CSSProperties } from "react";

const EMERALD = "#10b981"; // fallback --competition-color for a competition with no branding row
const GOLD = "#fbbf24";

// The unified match-card shape. Both `ContributingMatch` (Goals) and `FootballMatchLite` (the page
// rails) satisfy it structurally. Upcoming matches carry `utc_date` (→ countdown); logged matches
// carry `watched_at`/`watched_where` (→ ticket when watched at the stadium).
export interface MatchCardData {
  external_match_id: number;
  home_name: string;
  away_name: string;
  home_crest: string | null;
  away_crest: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  matchday: number | null;
  venue: string | null;
  competition_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  utc_date?: string | null;
  watched_at?: string | null;
  watched_where?: string | null;
}

function statusLabel(status: string | null): string {
  if (status === "IN_PLAY" || status === "PAUSED") return "Live";
  return "FT";
}

// Compact countdown to kickoff: "D-17" until the day, then "in 4h", then "in 42m".
function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d >= 1) return `D-${d}`;
  if (h >= 1) return `in ${h}h`;
  return `in ${m}m`;
}

function fmtDate(iso: string, withTime: boolean): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: withTime ? undefined : "numeric" });
  if (!withTime) return date;
  return `${date} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function monogram(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}

function Crest({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-[11px] font-extrabold text-white/80 shadow-[0_4px_10px_rgba(0,0,0,.5)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- small external crest, no next/image domain needed
        <img src={url} alt="" className="h-8 w-8 object-contain" />
      ) : (
        monogram(name)
      )}
    </span>
  );
}

// A football match rendered as the gradient-top card: dark surface, the competition's colour as a
// soft glow at the top, white mark, crests, and then either a SCORE (finished) or a COUNTDOWN
// (upcoming). A match watched at the stadium becomes a gold ticket (gold edge, carved perforation).
// `onOpen` lets the page open it in a sliding panel; without it, it navigates to the match route.
export function FootballMatchCard({ match, onOpen }: { match: MatchCardData; onOpen?: (externalId: number) => void }) {
  const router = useRouter();
  const cc = match.brand_color || EMERALD;
  const stadium = match.watched_where === "stadium";
  const finished = match.status === "FINISHED";
  const hasScore = match.home_score != null && match.away_score != null;
  const showScore = finished || hasScore;
  const upcoming = !showScore && !!match.utc_date;

  const footerDate = match.watched_at ?? match.utc_date ?? null;
  const footerLabel = footerDate ? fmtDate(footerDate, upcoming) : "—";

  const rootStyle: CSSProperties = { ["--cc" as string]: cc };
  if (stadium) {
    Object.assign(rootStyle, {
      borderColor: "transparent",
      WebkitMaskImage:
        "radial-gradient(circle 14px at left calc(100% - 54px), transparent 98%, #000 100%), radial-gradient(circle 14px at right calc(100% - 54px), transparent 98%, #000 100%)",
      WebkitMaskComposite: "source-in",
      maskComposite: "intersect",
      filter: "drop-shadow(0 0 .8px #fbbf24) drop-shadow(0 0 9px rgba(251,191,36,.5))",
    } as CSSProperties);
  }

  const open = () => (onOpen ? onOpen(match.external_match_id) : router.push(`/perso/sports/football/match/${match.external_match_id}`));

  return (
    <button
      type="button"
      onClick={open}
      style={rootStyle}
      className="group relative isolate w-full overflow-hidden rounded-card border border-border-subtle bg-surface-1 text-left transition-transform duration-300 ease-out hover:-translate-y-1"
    >
      {/* the ONLY colour — a soft glow at the top in the competition's hue */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[150px] opacity-55"
        style={{ background: "radial-gradient(120% 150% at 22% -45%, var(--cc), transparent 66%)" }}
      />

      <div className="relative p-4">
        <div className="mb-4 flex min-h-[22px] items-center gap-2">
          {match.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- local recoloured SVG mark
            <img src={match.logo_url} alt="" className="h-[22px] w-auto drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]" />
          )}
          <span className="text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.5)]">
            {match.competition_name ?? "Football"}
          </span>
          {match.matchday != null && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-white/60">
              MD {match.matchday}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="flex flex-col items-center gap-2 pt-1">
            <Crest url={match.home_crest} name={match.home_name} />
            <span className="max-w-[92px] truncate text-[11px] font-semibold text-zinc-200">{match.home_name}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 pt-1">
            {showScore ? (
              <div className="flex items-baseline gap-1.5 text-[28px] font-extrabold leading-none tabular-nums text-white">
                <span>{match.home_score ?? "–"}</span>
                <span className="text-lg font-normal text-white/50">–</span>
                <span>{match.away_score ?? "–"}</span>
              </div>
            ) : (
              <div className="text-lg font-black uppercase tracking-widest text-white/35">vs</div>
            )}
            {showScore ? (
              <span className="rounded-md bg-white/10 px-2 py-0.75 text-[9px] font-extrabold uppercase tracking-wide text-white/70">
                {statusLabel(match.status)}
              </span>
            ) : upcoming ? (
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.75 text-[9px] font-extrabold uppercase tracking-wide"
                style={{ background: "color-mix(in srgb, var(--cc) 16%, transparent)", color: "color-mix(in srgb, var(--cc) 80%, white)" }}
              >
                <Clock size={9} />
                {countdown(match.utc_date!)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-2 pt-1">
            <Crest url={match.away_crest} name={match.away_name} />
            <span className="max-w-[92px] truncate text-[11px] font-semibold text-zinc-200">{match.away_name}</span>
          </div>
        </div>
      </div>

      {/* footer — date · venue, gold when it's a stadium ticket */}
      <div
        className="relative flex items-center gap-2.5 border-t px-4"
        style={
          stadium
            ? { height: 54, borderTop: "1.5px dashed rgba(251,191,36,.55)", background: "color-mix(in srgb, #fbbf24 12%, rgba(0,0,0,.4))" }
            : { paddingTop: 10, paddingBottom: 10, borderColor: "var(--color-border-subtle, rgba(255,255,255,.07))", background: "rgba(0,0,0,.25)" }
        }
      >
        <span className="shrink-0" style={{ color: stadium ? GOLD : cc }}>
          {stadium ? <Ticket size={16} /> : <Calendar size={16} />}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-bold" style={{ color: stadium ? GOLD : "#fafafa" }}>{footerLabel}</span>
          {match.venue && <span className="truncate text-[10.5px] text-white/50">{match.venue}</span>}
        </div>
        <ChevronRight size={16} className="ml-auto shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
