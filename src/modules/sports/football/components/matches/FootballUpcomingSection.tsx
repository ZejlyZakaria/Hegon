"use client";

// Upcoming Matches — an independent section (its own hooks, no page monolith). A per-section select
// (search + teams) sits next to the title and filters the rail. Shows 4 matches in a single row.
// Card visual = the current design, kept as-is for now (design-system pass will unify it later).

import { useMemo, useState } from "react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useUpcomingMatches } from "../../hooks/useFootballMatches";
import { useUserPredictions } from "../../hooks/useFootballPrediction";
import { SectionHeader } from "@/shared/components/ui/section-header";
import SectionTeamSelect, { type SelectTeam } from "./SectionTeamSelect";
import { UpcomingMatchCard } from "./UpcomingMatchCard";

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
            <UpcomingMatchCard key={m.external_match_id} m={m} focusExt={focusExt} index={i} pick={predictions?.[m.external_match_id] ?? null} />
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
