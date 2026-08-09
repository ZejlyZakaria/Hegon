"use client";

// Recent Results — independent section (own hooks). Same per-section select as Upcoming, same card
// family (kept as-is for now), 4 results in a single row. Result colour (W/D/L) is relative to the
// focused team (selected, or the main team) when it's in the match; otherwise a neutral score.

import { useMemo, useState } from "react";
import Image from "next/image";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useRecentMatches } from "../../hooks/useFootballMatches";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite } from "../../service";
import { SectionHeader } from "@/shared/components/ui/section-header";
import SectionTeamSelect, { type SelectTeam } from "./SectionTeamSelect";

const CREST_FALLBACK = "/placeholder-logo.svg";

type Result = "W" | "D" | "L" | "N"; // N = neutral (focus team not in this match)

export default function FootballRecentSection() {
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
  const { data: matches, isLoading: matchesLoading } = useRecentMatches(extIds);

  // Default the filter to the user's main team (if any) until they pick something else.
  const [selected, setSelected] = useState<string>("");
  const active = selected || (teams?.mainTeam?.api_external_id ?? "all");
  const focusExt = active !== "all" ? active : null;

  const filtered = (matches ?? []).filter(
    (m) => active === "all" || m.home_external_id === active || m.away_external_id === active,
  );
  const shown = filtered.slice(0, 6);

  if (teamsLoading) return <RecentSkeleton withHeader />;
  if (!ordered.length) return null;

  const selectTeams: SelectTeam[] = ordered.map((t) => ({ id: t.id, name: t.name, crest: t.crest, isMain: t.isMain }));
  const loadingMatches = matchesLoading && !matches;

  return (
    <section>
      <SectionHeader
        title="Recent results"
        subtitle="Latest results for your teams"
        actions={<SectionTeamSelect teams={selectTeams} value={active} onChange={setSelected} />}
      />

      {loadingMatches ? (
        <ResultGridSkeleton />
      ) : shown.length === 0 ? (
        <div className="rounded-card border border-border-subtle bg-surface-1 py-8 text-center text-sm text-text-tertiary">
          No recent results
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((m) => (
            <ResultRow key={m.external_match_id} m={m} focusExt={focusExt} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Skeleton (matches the list rows) ────────────────────────────────────────────

function RecentSkeleton({ withHeader }: { withHeader?: boolean }) {
  return (
    <section>
      {withHeader && (
        <div className="mb-3 space-y-1.5">
          <div className="h-5 w-36 rounded bg-white/5" />
          <div className="h-3 w-48 rounded bg-white/5" />
        </div>
      )}
      <ResultGridSkeleton />
    </section>
  );
}

function ResultGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="surface-card animate-pulse rounded-card p-3.5">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-white/5" />
            <div className="h-2.5 w-16 rounded bg-white/5" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-white/5" />
            <div className="h-3 flex-1 rounded bg-white/5" />
            <div className="h-3 w-10 rounded bg-white/5" />
            <div className="h-3 flex-1 rounded bg-white/5" />
            <div className="h-6 w-6 rounded-full bg-white/5" />
          </div>
          <div className="mt-2 h-2.5 w-20 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function resultFor(m: FootballMatchLite, focusExt: string | null): Result {
  if (focusExt == null || m.home_score == null || m.away_score == null) return "N";
  const isHome = m.home_external_id === focusExt;
  const isAway = m.away_external_id === focusExt;
  if (!isHome && !isAway) return "N";
  const gf = isHome ? m.home_score : m.away_score;
  const ga = isHome ? m.away_score : m.home_score;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

// ─── Row (list style): competition + W/L/D badge · both crests + names + score · date ────────────

function ResultRow({ m, focusExt }: { m: FootballMatchLite; focusExt: string | null }) {
  const open = useMatchPanel((s) => s.open);
  const res = resultFor(m, focusExt);
  const compName = displayCompetitionName(m.competition_name);
  const homeWin = m.home_score != null && m.away_score != null && m.home_score > m.away_score;
  const awayWin = m.home_score != null && m.away_score != null && m.away_score > m.home_score;

  return (
    <button
      onClick={() => open(m.external_match_id)}
      className="group surface-card relative flex w-full flex-col gap-2 rounded-card p-3.5 text-left transition-all hover:-translate-y-0.5"
    >
      {/* result badge — top right, reads as the MATCH result (not tied to a team's side) */}
      <ResultBadge res={res} className="absolute right-2.5 top-2.5" />

      {/* competition — left, colour logo, normal case */}
      <div className="flex items-center gap-1.5 pr-8">
        <CompMark logoUrl={m.logo_url} emblemUrl={m.emblem_url} name={compName} />
        <span className="truncate text-[11px] font-medium text-text-tertiary">{compName}</span>
      </div>

      {/* home crest · name · score · name · away crest */}
      <div className="flex items-center gap-2">
        <Crest src={m.home_crest} alt={m.home_name} />
        <span className={`min-w-0 flex-1 truncate text-sm ${homeWin ? "font-semibold text-text-primary" : "text-text-secondary"}`}>{m.home_name}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-text-primary">
          {m.home_score}<span className="mx-1 text-text-tertiary">-</span>{m.away_score}
        </span>
        <span className={`min-w-0 flex-1 truncate text-right text-sm ${awayWin ? "font-semibold text-text-primary" : "text-text-secondary"}`}>{m.away_name}</span>
        <Crest src={m.away_crest} alt={m.away_name} />
      </div>

      {/* date */}
      <span className="text-[11px] text-text-tertiary">{fmtDate(m.utc_date)}</span>
    </button>
  );
}

function ResultBadge({ res, className = "" }: { res: Result; className?: string }) {
  const cls =
    res === "W" ? "bg-accent-sports/15 text-accent-sports"
      : res === "L" ? "bg-red-500/15 text-red-400"
        : "bg-surface-3 text-text-secondary";
  return (
    <span className={`flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-black ${cls} ${className}`}>
      {res === "N" ? "FT" : res}
    </span>
  );
}

function Crest({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative h-6 w-6 shrink-0">
      <Image src={src || CREST_FALLBACK} alt={alt} fill sizes="24px" className="object-contain" />
    </span>
  );
}

// Competition mark — colour asset logo (UCL stays white); football-data emblem on a white chip as fallback.
function CompMark({ logoUrl, emblemUrl, name }: { logoUrl: string | null; emblemUrl: string | null; name: string }) {
  const asset = logoUrl
    ? logoUrl.includes("champions-league") ? logoUrl : logoUrl.replace("/leagues-white-logos/", "/leagues-logos/")
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
