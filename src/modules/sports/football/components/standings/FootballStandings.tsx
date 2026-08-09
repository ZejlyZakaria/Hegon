"use client";

// Standings — independent section (own hooks). Filtered by COMPETITION (a select next to the title),
// the table computed from that competition's DB matches. The user's favourite teams are highlighted.

import { useMemo, useState } from "react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useFollowedCompetitions } from "../../hooks/useFollowedCompetitions";
import { useStandings } from "../../hooks/useFootballCompetition";
import { displayCompetitionName } from "../../service";
import { SectionHeader } from "@/shared/components/ui/section-header";
import SectionTeamSelect, { type SelectTeam } from "../matches/SectionTeamSelect";
import StandingsTable from "./StandingsTable";

export default function FootballStandings() {
  const userId = useCurrentUserId();
  const { data: teams } = useFootballTeams(userId);
  const { data: competitions, isLoading: compsLoading } = useFollowedCompetitions(userId);

  const favExtIds = useMemo(() => {
    const s = new Set<string>();
    if (teams?.mainTeam) s.add(teams.mainTeam.api_external_id);
    for (const t of teams?.otherFavoriteTeams ?? []) s.add(t.api_external_id);
    return s;
  }, [teams]);

  const [selected, setSelected] = useState<string>("");
  const comps = competitions ?? [];
  const activeComp = selected || comps[0]?.id || "";
  const activeCode = comps.find((c) => c.id === activeComp)?.code ?? null;

  const { data: standings, isLoading: standingsLoading } = useStandings(activeComp || null);

  if (compsLoading) return <StandingsSectionSkeleton />;
  if (!comps.length) return null;

  // Colour asset logo in the select (UCL stays white — its colour variant vanishes on dark).
  const compLogo = (logoUrl: string | null) =>
    logoUrl
      ? logoUrl.includes("champions-league")
        ? logoUrl
        : logoUrl.replace("/leagues-white-logos/", "/leagues-logos/")
      : null;

  const selectItems: SelectTeam[] = comps.map((c) => ({
    id: c.id,
    name: displayCompetitionName(c.name),
    crest: compLogo(c.logo_url) || c.emblem_url,
  }));

  return (
    <section>
      <SectionHeader
        title="Standings"
        subtitle="Live tables for your competitions"
        actions={
          <SectionTeamSelect
            teams={selectItems}
            value={activeComp}
            onChange={setSelected}
            includeAll={false}
            searchPlaceholder="Search competition…"
          />
        }
      />
      <div className="rounded-card bg-surface-1 p-3">
        {standingsLoading && !standings ? (
          <StandingsRowsSkeleton />
        ) : (
          <StandingsTable rows={standings ?? []} highlightExtIds={favExtIds} competitionCode={activeCode} />
        )}
      </div>
    </section>
  );
}

// ─── Skeletons (match the redesigned table) ──────────────────────────────────────

function StandingsSectionSkeleton() {
  return (
    <section>
      <div className="mb-3 space-y-1.5">
        <div className="h-5 w-28 rounded bg-white/5" />
        <div className="h-3 w-52 rounded bg-white/5" />
      </div>
      <div className="rounded-card bg-surface-1 p-3">
        <StandingsRowsSkeleton />
      </div>
    </section>
  );
}

function StandingsRowsSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 border-t border-border-subtle py-2.5 first:border-t-0">
          <div className="h-4 w-0.5 shrink-0 rounded-full bg-white/5" />
          <div className="h-3 w-3 rounded bg-white/5" />
          <div className="h-5 w-5 rounded-full bg-white/5" />
          <div className="h-3 rounded bg-white/5" style={{ width: `${55 - i * 3}%` }} />
          <div className="ml-auto h-3 w-6 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
