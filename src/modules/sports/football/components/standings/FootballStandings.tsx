"use client";

// Standings — independent section (own hooks). Filtered by COMPETITION (a select next to the title),
// the table computed from that competition's DB matches. The user's favourite teams are highlighted.

import { useMemo, useState } from "react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useFollowedCompetitions } from "../../hooks/useFollowedCompetitions";
import { useCompetitionMatches } from "../../hooks/useFootballCompetition";
import { computeStandings, displayCompetitionName } from "../../service";
import SectionTeamSelect, { type SelectTeam } from "../matches/SectionTeamSelect";
import StandingsTable from "./StandingsTable";

export default function FootballStandings() {
  const userId = useCurrentUserId();
  const { data: teams } = useFootballTeams(userId);
  const { data: competitions } = useFollowedCompetitions(userId);

  const favExtIds = useMemo(() => {
    const s = new Set<string>();
    if (teams?.mainTeam) s.add(teams.mainTeam.api_external_id);
    for (const t of teams?.otherFavoriteTeams ?? []) s.add(t.api_external_id);
    return s;
  }, [teams]);

  const [selected, setSelected] = useState<string>("");
  const comps = competitions ?? [];
  const activeComp = selected || comps[0]?.id || "";

  const { data: matches } = useCompetitionMatches(activeComp || null);
  const standings = useMemo(() => computeStandings(matches ?? []), [matches]);

  if (!comps.length) return null;

  const selectItems: SelectTeam[] = comps.map((c) => ({
    id: c.id,
    name: displayCompetitionName(c.name),
    crest: c.logo_url || c.emblem_url,
  }));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">Standings</h2>
        <SectionTeamSelect
          teams={selectItems}
          value={activeComp}
          onChange={setSelected}
          includeAll={false}
          searchPlaceholder="Search competition…"
        />
      </div>
      <div className="rounded-card bg-surface-1 p-3">
        <StandingsTable rows={standings} highlightExtIds={favExtIds} />
      </div>
    </section>
  );
}
