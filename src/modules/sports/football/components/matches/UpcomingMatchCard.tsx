"use client";

// THE upcoming-match card. Lifted out of FootballUpcomingSection so the team page's "Next match"
// shows the SAME card the main page does, instead of the thin logo-name-date bar it used to be:
// one match card in this module, not two designs for one object. Visual unchanged (owner-approved).

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, Clock, MapPin, Target } from "lucide-react";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";

export function UpcomingMatchCard({ m, focusExt, index, pick }: { m: FootballMatchLite; focusExt: string | null; index: number; pick: { home: number; away: number } | null }) {
  const open = useMatchPanel((s) => s.open);
  const isHome = focusExt != null && m.home_external_id === focusExt;
  const isAway = focusExt != null && m.away_external_id === focusExt;
  const countdown = getCountdown(m.utc_date);
  const compName = displayCompetitionName(m.competition_name);

  return (
    <div
      onClick={() => open(m.external_match_id)}
      role="button"
      style={{ animationDelay: `${index * 60}ms` }}
      className="group surface-card relative cursor-pointer overflow-hidden rounded-card transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="relative flex flex-col gap-3.5 p-4">
        {/* competition + countdown */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <CompMark logoUrl={m.logo_url} emblemUrl={m.emblem_url} name={compName} />
            <span className="truncate text-[11px] font-medium text-text-tertiary">{compName}</span>
          </div>
          <CountdownChip cd={countdown} />
        </div>

        {/* teams — logos anchored, names on a fixed 2-line block, so both crests share a line.
            Center: "VS", or YOUR PICK once you've predicted (same footprint → cards stay aligned). */}
        <div className="flex items-start gap-2">
          <TeamCol name={m.home_name} crest={m.home_crest} focused={isHome} side={focusExt ? "Home" : null} />
          <div className="flex h-11 w-12 shrink-0 flex-col items-center justify-center gap-0.5">
            {pick ? (
              <>
                <span className="text-sm font-bold tabular-nums text-accent-sports">{pick.home}–{pick.away}</span>
                <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wide text-accent-sports/70">
                  <Target size={8} /> Pick
                </span>
              </>
            ) : (
              <span className="text-[10px] font-black tracking-widest text-text-tertiary">VS</span>
            )}
          </div>
          <TeamCol name={m.away_name} crest={m.away_crest} focused={isAway} side={focusExt ? "Away" : null} />
        </div>

        {/* date · time · stadium */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-border-subtle pt-3 text-xs">
          <span className="font-semibold text-text-secondary">{formatMatchDate(m.utc_date)}</span>
          <span className="text-text-tertiary">·</span>
          <span className="font-medium text-text-tertiary">{formatTime(m.utc_date)}</span>
          {m.venue && (
            <>
              <span className="text-text-tertiary">·</span>
              <span className="inline-flex min-w-0 items-center gap-1 text-text-tertiary">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{m.venue}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Competition mark: our curated COLOUR asset logo (visible on the dark surface). UCL is the exception —
// its logo is white-only, so the colour variant would vanish → keep the white one. No asset → the
// football-data colour emblem on a small white chip.
function CompMark({ logoUrl, emblemUrl, name }: { logoUrl: string | null; emblemUrl: string | null; name: string }) {
  const asset = logoUrl
    ? logoUrl.includes("champions-league")
      ? logoUrl
      : logoUrl.replace("/leagues-white-logos/", "/leagues-logos/")
    : null;
  if (asset) {
    return (
      <span className="relative h-5 w-5 shrink-0">
        <Image src={asset} alt={name} fill sizes="20px" className="object-contain" />
      </span>
    );
  }
  if (emblemUrl) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white p-0.5">
        <span className="relative h-full w-full">
          <Image src={emblemUrl} alt={name} fill sizes="16px" className="object-contain" />
        </span>
      </span>
    );
  }
  return null;
}

// Premium countdown: emphasised number + quiet unit, tinted lime when the match is near; a pulsing dot
// for a live game. The H/A of your team lives on the crest (a corner badge), not here.
function CountdownChip({ cd }: { cd: Countdown }) {
  if (cd.live) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-sports/15 px-2 py-0.5 text-[11px] font-bold text-accent-sports">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-sports opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-sports" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-baseline gap-1 rounded-full px-2 py-0.5 ${
        cd.urgent ? "bg-accent-sports/15" : "bg-surface-3"
      }`}
    >
      <span className={`text-sm font-bold tabular-nums ${cd.urgent ? "text-accent-sports" : "text-text-primary"}`}>{cd.value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">{cd.unit}</span>
    </span>
  );
}

function TeamCol({ name, crest, focused, side }: { name: string; crest: string | null; focused: boolean; side: "Home" | "Away" | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
      <div className="relative h-11 w-11 shrink-0">
        <Image src={crest || CREST_FALLBACK} alt={name} fill sizes="44px" className="object-contain p-0.5" />
        {focused && side && (
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-sports px-1 text-[8px] font-black text-accent-sports-deep ring-2 ring-surface-1">
            {side === "Home" ? "H" : "A"}
          </span>
        )}
      </div>
      <span className={`line-clamp-2 flex h-8 items-start justify-center text-[11px] font-semibold leading-tight ${focused ? "text-text-primary" : "text-text-tertiary"}`}>
        {name}
      </span>
    </div>
  );
}

// ─── Helpers (kept from the current card) ────────────────────────────────────────

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatMatchDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
type Countdown = { value: string; unit: string; live: boolean; urgent: boolean };
function getCountdown(dateStr: string): Countdown {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return { value: "", unit: "", live: true, urgent: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days === 0 && hours === 0) return { value: "<1", unit: "hr", live: false, urgent: true };
  if (days === 0) return { value: `${hours}`, unit: hours === 1 ? "hr" : "hrs", live: false, urgent: true };
  return { value: `${days}`, unit: days === 1 ? "day" : "days", live: false, urgent: false };
}

// ─── The FEATURE density ─────────────────────────────────────────────────────────
// Same card, more presence. One fixture alone in a rail can carry weight that one of four in a row
// cannot: full crests, the matchday, the venue, and a segmented countdown. Shares every primitive
// with the compact card above (CompMark, the date/time helpers) so the two cannot drift apart.

/**
 * A per-second tick is only honest inside the last hour. Before that a minute is plenty, and a 1s
 * interval would be battery spent re-rendering a number that barely moves — which is why the seconds
 * segment only exists on match day (see `segments` below).
 */
function useCountdownParts(dateStr: string) {
  // `now` is STATE, never Date.now() read during render: the clock is impure, and a server render
  // would disagree with the first client one anyway. Until the effect runs the card shows "--", which
  // occupies the same box — so the value fills in without moving anything.
  const [now, setNow] = useState<number | null>(null);
  const target = new Date(dateStr).getTime();
  const diff = now == null ? 0 : target - now;
  const underHour = now != null && diff > 0 && diff < 3_600_000;
  useEffect(() => {
    // The clock is an external system we SUBSCRIBE to; every value — the first one included — arrives
    // through a timer callback. Setting it synchronously in the effect body would be a cascading
    // render, and the timeout costs one tick of the event loop, which nobody can see.
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, underHour ? 1000 : 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [underHour]);
  if (now == null) return { ready: false, live: false, days: 0, hours: 0, mins: 0, secs: 0 };
  if (diff <= 0) return { ready: true, live: true, days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    ready: true,
    live: false,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1000),
  };
}

export function FeatureMatchCard({ m, focusExt, pick }: { m: FootballMatchLite; focusExt: string | null; pick: { home: number; away: number } | null }) {
  const open = useMatchPanel((s) => s.open);
  const compName = displayCompetitionName(m.competition_name);
  const cd = useCountdownParts(m.utc_date);
  const isHome = focusExt != null && m.home_external_id === focusExt;
  const isAway = focusExt != null && m.away_external_id === focusExt;

  // Always three segments. Days disappear on match day and seconds take their place — the unit that
  // matters is the one that is actually moving.
  const segments: [string, string][] = !cd.ready
    ? [["--", "Days"], ["--", "Hrs"], ["--", "Min"]]
    : cd.days > 0
      ? [[pad(cd.days), "Days"], [pad(cd.hours), "Hrs"], [pad(cd.mins), "Min"]]
      : [[pad(cd.hours), "Hrs"], [pad(cd.mins), "Min"], [pad(cd.secs), "Sec"]];

  return (
    <div
      onClick={() => open(m.external_match_id)}
      role="button"
      className="group surface-card cursor-pointer overflow-hidden rounded-card transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* competition · matchday */}
      <div className="flex items-center justify-center gap-2 border-b border-border-subtle px-4 py-3">
        <CompMark logoUrl={m.logo_url} emblemUrl={m.emblem_url} name={compName} />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{compName}</span>
        {m.matchday != null && (
          <>
            <span className="text-text-tertiary">·</span>
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Matchday {m.matchday}</span>
          </>
        )}
      </div>

      <div className="px-4 py-5">
        <div className="flex items-start gap-3">
          <BigTeamCol name={m.home_name} crest={m.home_crest} focused={isHome} side={focusExt ? "H" : null} />
          <div className="flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-0.5">
            {pick ? (
              <>
                <span className="text-base font-bold tabular-nums text-accent-sports">{pick.home}–{pick.away}</span>
                <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wide text-accent-sports/70">
                  <Target size={8} /> Pick
                </span>
              </>
            ) : (
              <span className="text-xs font-black tracking-widest text-text-tertiary">VS</span>
            )}
          </div>
          <BigTeamCol name={m.away_name} crest={m.away_crest} focused={isAway} side={focusExt ? "A" : null} />
        </div>

        {/* date · time · venue */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border-subtle pt-3.5 text-xs text-text-tertiary">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} className="shrink-0" />{fullMatchDate(m.utc_date)}</span>
          <span className="text-border-strong">|</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={12} className="shrink-0" />{formatTime(m.utc_date)}</span>
          {m.venue && (
            <>
              <span className="text-border-strong">|</span>
              <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin size={12} className="shrink-0" /><span className="truncate">{m.venue}</span></span>
            </>
          )}
        </div>

        {cd.ready && cd.live ? (
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-border-subtle pt-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-sports opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-sports" />
            </span>
            <span className="text-sm font-bold uppercase tracking-wide text-accent-sports">Live</span>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 divide-x divide-border-subtle border-t border-border-subtle pt-4">
            {segments.map(([value, unit]) => (
              <div key={unit} className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-bold tabular-nums text-text-primary">{value}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">{unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BigTeamCol({ name, crest, focused, side }: { name: string; crest: string | null; focused: boolean; side: "H" | "A" | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <div className="relative h-16 w-16 shrink-0">
        <Image src={crest || CREST_FALLBACK} alt={name} fill sizes="64px" className="object-contain" />
        {focused && side && (
          <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-sports px-1 text-[9px] font-black text-accent-sports-deep ring-2 ring-surface-1">
            {side}
          </span>
        )}
      </div>
      <span className={`line-clamp-2 text-xs font-semibold leading-tight ${focused ? "text-text-primary" : "text-text-secondary"}`}>{name}</span>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

function fullMatchDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
