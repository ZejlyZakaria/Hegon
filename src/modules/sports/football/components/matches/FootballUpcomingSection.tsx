"use client";

// Upcoming Matches — an independent section (its own hooks, no page monolith). A per-section select
// (search + teams) sits next to the title and filters the rail. Shows 4 matches in a single row.
// Card visual = the current design, kept as-is for now (design-system pass will unify it later).

import { useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, Target } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useUpcomingMatches } from "../../hooks/useFootballMatches";
import { useUserPredictions } from "../../hooks/useFootballPrediction";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite } from "../../service";
import { SectionHeader } from "@/shared/components/ui/section-header";
import SectionTeamSelect, { type SelectTeam } from "./SectionTeamSelect";

const CREST_FALLBACK = "/placeholder-logo.svg";

export default function FootballUpcomingSection() {
  const userId = useCurrentUserId();
  const { data: teams, isLoading: teamsLoading } = useFootballTeams(userId);

  const ordered = useMemo(() => {
    if (!teams) return [] as { id: string; name: string; crest: string | null; isMain: boolean }[];
    const list: { id: string; name: string; crest: string | null; isMain: boolean }[] = [];
    if (teams.mainTeam) list.push({ id: teams.mainTeam.api_external_id, name: teams.mainTeam.name, crest: teams.mainTeam.crest_url, isMain: true });
    for (const t of teams.otherFavoriteTeams) list.push({ id: t.api_external_id, name: t.name, crest: t.crest_url, isMain: false });
    return list;
  }, [teams]);

  const extIds = ordered.map((t) => t.id);
  const { data: matches, isLoading: matchesLoading } = useUpcomingMatches(extIds);
  const { data: predictions } = useUserPredictions(userId);

  // Default the filter to the user's main team (if any) until they pick something else.
  const [selected, setSelected] = useState<string>("");
  const active = selected || (teams?.mainTeam?.api_external_id ?? "all");
  const focusExt = active !== "all" ? active : null;

  const filtered = (matches ?? []).filter(
    (m) => active === "all" || m.home_external_id === active || m.away_external_id === active,
  );
  const shown = filtered.slice(0, 4);

  // Still resolving who the user follows → skeleton (we don't yet know if this section applies).
  if (teamsLoading) return <UpcomingSkeleton withHeader />;
  // Loaded, but the user follows no team → the section doesn't apply.
  if (!ordered.length) return null;

  const selectTeams: SelectTeam[] = ordered.map((t) => ({ id: t.id, name: t.name, crest: t.crest, isMain: t.isMain }));
  const loadingMatches = matchesLoading && !matches;

  return (
    <section>
      <SectionHeader
        title="Upcoming"
        subtitle="Next fixtures for your teams"
        actions={<SectionTeamSelect teams={selectTeams} value={active} onChange={setSelected} />}
      />

      {loadingMatches ? (
        <MatchGridSkeleton />
      ) : shown.length === 0 ? (
        <div className="rounded-card border border-border-subtle bg-surface-1 py-8 text-center text-sm text-text-tertiary">
          No upcoming match
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((m, i) => (
            <MatchCard key={m.external_match_id} m={m} focusExt={focusExt} index={i} pick={predictions?.[m.external_match_id] ?? null} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Skeleton (matches the redesigned card) ──────────────────────────────────────

function UpcomingSkeleton({ withHeader }: { withHeader?: boolean }) {
  return (
    <section>
      {withHeader && (
        <div className="mb-3 space-y-1.5">
          <div className="h-5 w-28 rounded bg-white/5" />
          <div className="h-3 w-44 rounded bg-white/5" />
        </div>
      )}
      <MatchGridSkeleton />
    </section>
  );
}

function MatchGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="surface-card animate-pulse rounded-card p-4">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-white/5" />
              <div className="h-2.5 w-16 rounded bg-white/5" />
            </div>
            <div className="h-5 w-10 rounded-full bg-white/5" />
          </div>
          <div className="flex items-start gap-2">
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <div className="h-11 w-11 rounded-full bg-white/5" />
              <div className="h-2.5 w-14 rounded bg-white/5" />
            </div>
            <div className="mt-3 h-3 w-6 rounded bg-white/5" />
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <div className="h-11 w-11 rounded-full bg-white/5" />
              <div className="h-2.5 w-14 rounded bg-white/5" />
            </div>
          </div>
          <div className="mt-3.5 flex justify-center gap-2 border-t border-border-subtle pt-3">
            <div className="h-2.5 w-24 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
// Fixed heights on the logo / name / H-A rows keep the two crests on the SAME line whatever the name
// wraps to. Competition mark uses our curated asset logo (white, on the dark surface); accents are lime.

function MatchCard({ m, focusExt, index, pick }: { m: FootballMatchLite; focusExt: string | null; index: number; pick: { home: number; away: number } | null }) {
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
