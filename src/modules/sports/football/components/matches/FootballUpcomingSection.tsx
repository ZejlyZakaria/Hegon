"use client";

// Upcoming Matches — an independent section (its own hooks, no page monolith). A per-section select
// (search + teams) sits next to the title and filters the rail. Shows 4 matches in a single row.
// Card visual = the current design, kept as-is for now (design-system pass will unify it later).

import { useMemo, useState } from "react";
import Image from "next/image";
import { Clock, MapPin } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useUpcomingMatches } from "../../hooks/useFootballMatches";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite } from "../../service";
import SectionTeamSelect, { type SelectTeam } from "./SectionTeamSelect";

const CREST_FALLBACK = "/placeholder-logo.svg";

export default function FootballUpcomingSection() {
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
  const { data: matches } = useUpcomingMatches(extIds);

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
        <h2 className="text-base font-semibold text-text-primary">Upcoming Matches</h2>
        <SectionTeamSelect teams={selectTeams} value={selected} onChange={setSelected} />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-card border border-border-subtle bg-surface-1 py-8 text-center text-sm text-text-tertiary">
          No upcoming match
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((m, i) => (
            <MatchCard key={m.external_match_id} m={m} focusExt={focusExt} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Card (current design, adapted to FootballMatchLite) ────────────────────────

function MatchCard({ m, focusExt, index }: { m: FootballMatchLite; focusExt: string | null; index: number }) {
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
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 transition-all duration-300 hover:border-zinc-700/80 hover:bg-zinc-900/60"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.06),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${countdown.urgent ? "via-amber-400/60" : "via-indigo-500/30"} to-transparent`} />

      <div className="relative flex flex-col gap-4 p-4">
        {/* competition + countdown */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {m.emblem_url && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-white p-1">
                <span className="relative h-full w-full">
                  <Image src={m.emblem_url} alt={compName} fill sizes="16px" className="object-contain" />
                </span>
              </span>
            )}
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{compName}</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            countdown.urgent ? "border border-amber-500/25 bg-amber-500/10 text-amber-400" : "border border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
          }`}>
            <Clock size={10} />
            {countdown.label}
          </div>
        </div>

        {/* teams */}
        <div className="flex items-center gap-2">
          <TeamCol name={m.home_name} crest={m.home_crest} focused={isHome} />
          <div className="flex min-w-13 shrink-0 flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-px w-4 bg-zinc-700" />
              <span className="text-[10px] font-black tracking-widest text-zinc-500">VS</span>
              <div className="h-px w-4 bg-zinc-700" />
            </div>
            {focusExt && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                <MapPin size={8} />
                <span>{isHome ? "Home" : "Away"}</span>
              </div>
            )}
          </div>
          <TeamCol name={m.away_name} crest={m.away_crest} focused={isAway} />
        </div>

        {/* date + time */}
        <div className="flex items-center justify-center gap-2 border-t border-zinc-800/60 pt-3 text-xs">
          <span className="font-semibold text-zinc-300">{formatMatchDate(m.utc_date)}</span>
          <span className="text-zinc-700">·</span>
          <Clock size={11} className="text-zinc-500" />
          <span className="font-medium text-zinc-400">{formatTime(m.utc_date)}</span>
        </div>
      </div>
    </div>
  );
}

function TeamCol({ name, crest, focused }: { name: string; crest: string | null; focused: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <div className="relative h-11 w-11">
        {focused && <div className="absolute inset-0 scale-150 rounded-full bg-indigo-400/10 blur-xl" />}
        <Image src={crest || CREST_FALLBACK} alt={name} fill sizes="44px" className="relative z-10 object-contain" />
      </div>
      <span className={`line-clamp-2 text-[11px] font-semibold leading-tight ${focused ? "text-white" : "text-zinc-400"}`}>{name}</span>
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
function getCountdown(dateStr: string): { label: string; urgent: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return { label: "In Progress", urgent: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days === 0 && hours === 0) return { label: "<1h", urgent: true };
  if (days === 0) return { label: `${hours}h`, urgent: true };
  return { label: `D-${days}`, urgent: false };
}
