"use client";

// Recent Results — independent section (own hooks). Same per-section select as Upcoming, same card
// family (kept as-is for now), 4 results in a single row. Result colour (W/D/L) is relative to the
// focused team (selected, or the main team) when it's in the match; otherwise a neutral score.

import { useMemo, useState } from "react";
import Image from "next/image";
import { Calendar } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useRecentMatches } from "../../hooks/useFootballMatches";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite } from "../../service";
import SectionTeamSelect, { type SelectTeam } from "./SectionTeamSelect";

const CREST_FALLBACK = "/placeholder-logo.svg";

type Result = "W" | "D" | "L" | "N"; // N = neutral (focus team not in this match)

const RESULT_CONFIG: Record<Result, { label: string; pill: string; accent: string; glow: string; scoreColor: string }> = {
  W: { label: "W", pill: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", accent: "via-emerald-500/30", glow: "rgba(52,211,153,0.06)", scoreColor: "text-emerald-400" },
  D: { label: "D", pill: "bg-zinc-700/40 border-zinc-600/30 text-zinc-400", accent: "via-zinc-500/20", glow: "rgba(113,113,122,0.04)", scoreColor: "text-zinc-300" },
  L: { label: "L", pill: "bg-red-500/15 border-red-500/30 text-red-400", accent: "via-red-500/25", glow: "rgba(239,68,68,0.06)", scoreColor: "text-red-400" },
  N: { label: "FT", pill: "bg-zinc-700/40 border-zinc-600/30 text-zinc-400", accent: "via-zinc-500/20", glow: "rgba(113,113,122,0.04)", scoreColor: "text-zinc-200" },
};

export default function FootballRecentSection() {
  const userId = useCurrentUserId();
  const { data: teams } = useFootballTeams(userId);

  const ordered = useMemo(() => {
    if (!teams) return [] as { id: string; name: string; crest: string | null; isMain: boolean }[];
    const list: { id: string; name: string; crest: string | null; isMain: boolean }[] = [];
    if (teams.mainTeam) list.push({ id: teams.mainTeam.api_external_id, name: teams.mainTeam.name, crest: teams.mainTeam.crest_url, isMain: true });
    for (const t of teams.otherFavoriteTeams) list.push({ id: t.api_external_id, name: t.name, crest: t.crest_url, isMain: false });
    return list;
  }, [teams]);

  const extIds = ordered.map((t) => t.id);
  const { data: matches } = useRecentMatches(extIds);

  const [selected, setSelected] = useState<string>("all");
  const focusExt = selected !== "all" ? selected : (teams?.mainTeam?.api_external_id ?? null);

  const filtered = (matches ?? []).filter(
    (m) => selected === "all" || m.home_external_id === selected || m.away_external_id === selected,
  );
  const shown = filtered.slice(0, 4);

  if (!ordered.length) return null;

  const selectTeams: SelectTeam[] = ordered.map((t) => ({ id: t.id, name: t.name, crest: t.crest, isMain: t.isMain }));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">Recent Results</h2>
        <SectionTeamSelect teams={selectTeams} value={selected} onChange={setSelected} />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-card border border-border-subtle bg-surface-1 py-8 text-center text-sm text-text-tertiary">
          No recent results
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((m) => (
            <ResultCard key={m.external_match_id} m={m} focusExt={focusExt} />
          ))}
        </div>
      )}
    </section>
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

// ─── Card (current result-card design, adapted to FootballMatchLite) ─────────────

function ResultCard({ m, focusExt }: { m: FootballMatchLite; focusExt: string | null }) {
  const open = useMatchPanel((s) => s.open);
  const isHome = focusExt != null && m.home_external_id === focusExt;
  const isAway = focusExt != null && m.away_external_id === focusExt;
  const cfg = RESULT_CONFIG[resultFor(m, focusExt)];
  const compName = displayCompetitionName(m.competition_name);

  return (
    <div
      onClick={() => open(m.external_match_id)}
      role="button"
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 transition-all duration-300 hover:border-zinc-700/80"
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(ellipse at top, ${cfg.glow}, transparent 70%)` }} />
      <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${cfg.accent} to-transparent`} />

      <div className="relative flex flex-col gap-4 p-4">
        {/* competition + result badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {m.emblem_url && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-white p-1">
                <span className="relative h-full w-full">
                  <Image src={m.emblem_url} alt={compName} fill sizes="24px" className="object-contain" />
                </span>
              </span>
            )}
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{compName}</span>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${cfg.pill}`}>{cfg.label}</span>
        </div>

        {/* teams + score */}
        <div className="flex items-center gap-2">
          <TeamCol name={m.home_name} crest={m.home_crest} focused={isHome} />
          <div className="flex min-w-13 shrink-0 flex-col items-center gap-1">
            <div className={`flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900 px-3 py-1 ${cfg.scoreColor}`}>
              <span className="text-2xl font-black tabular-nums tracking-tight">{m.home_score}</span>
              <span className="text-lg font-bold text-zinc-700">-</span>
              <span className="text-2xl font-black tabular-nums tracking-tight">{m.away_score}</span>
            </div>
          </div>
          <TeamCol name={m.away_name} crest={m.away_crest} focused={isAway} />
        </div>

        {/* date */}
        <div className="flex items-center justify-center gap-2 border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
          <Calendar size={11} />
          <span>{fmtDate(m.utc_date)}</span>
        </div>
      </div>
    </div>
  );
}

function TeamCol({ name, crest, focused }: { name: string; crest: string | null; focused: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <div className="relative h-11 w-11">
        {focused && <div className="absolute inset-0 scale-150 rounded-full bg-emerald-400/10 blur-xl" />}
        <Image src={crest || CREST_FALLBACK} alt={name} fill sizes="44px" className="relative z-10 object-contain" />
      </div>
      <span className={`line-clamp-2 text-[11px] font-semibold leading-tight ${focused ? "text-white" : "text-zinc-400"}`}>{name}</span>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
