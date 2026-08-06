"use client";

// The Following strip — the top section of the Football page. It is a LAUNCHER, not a filter:
//   · a card per followed team (1st axis, user_favorites) → opens the Team Panel on click,
//   · followed competitions (2nd axis) after a divider, each carrying its brand glow,
//   · a trailing "Follow" card to add.
// Main team stands out by MATERIAL (graphite raised surface) + a star, never by a border or a label
// that would shift the row's alignment. Removal lives in the Team Panel (not here).
// Data is its own concern: useFootballTeams + useFollowedCompetitions (no page monolith).

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Plus, Star } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useFollowedCompetitions } from "../../hooks/useFollowedCompetitions";
import { useTeamPanel } from "../../hooks/useTeamPanelStore";
import type { FootballTeam } from "../../types";
import type { FollowedCompetition } from "../../service";
import FootballAddModal from "../modals/FootballAddModal";

const CREST_FALLBACK = "/placeholder-logo.svg";
const CARD_BASE = "relative flex w-28 min-h-26 shrink-0 flex-col items-center gap-2 rounded-card px-3 pb-3 pt-4 transition-all";

export default function FollowingStrip() {
  const userId = useCurrentUserId();
  const openTeam = useTeamPanel((s) => s.open);

  const { data: teams, isLoading: teamsLoading } = useFootballTeams(userId);
  const { data: competitions } = useFollowedCompetitions(userId);

  const [addOpen, setAddOpen] = useState(false);

  // Main team first so the eye lands on it.
  const orderedTeams = useMemo<{ team: FootballTeam; isMain: boolean }[]>(() => {
    if (!teams) return [];
    const list: { team: FootballTeam; isMain: boolean }[] = [];
    if (teams.mainTeam) list.push({ team: teams.mainTeam, isMain: true });
    for (const t of teams.otherFavoriteTeams) list.push({ team: t, isMain: false });
    return list;
  }, [teams]);

  const followedCompetitions = competitions ?? [];

  if (teamsLoading && !teams) return <FollowingStripSkeleton />;

  return (
    <section>
      <div className="px-1 pb-2">
        <h3 className="text-title text-text-primary">Following</h3>
      </div>

      {/* py-2 -my-2: room for the hover lift + shadow/glow (overflow-x makes overflow-y clip). */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto py-2 -my-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Teams — click opens the Team Panel */}
        {orderedTeams.map(({ team, isMain }) => (
          <button
            key={team.id}
            onClick={() => openTeam({ ...team, isMain })}
            className={`${CARD_BASE} ${isMain ? "bg-accent-sports-deep" : "surface-card"} hover:-translate-y-0.5`}
          >
            {isMain && (
              <Star size={13} className="absolute right-2 top-2 fill-accent-sports text-accent-sports" />
            )}
            <div className="relative h-11 w-11 shrink-0">
              <Image
                src={team.crest_url || CREST_FALLBACK}
                alt={team.name}
                fill
                sizes="44px"
                className="object-contain drop-shadow"
              />
            </div>
            <span className="line-clamp-2 max-w-full text-center text-xs font-semibold leading-tight text-text-primary">
              {team.name}
            </span>
          </button>
        ))}

        {/* Divider between the two follow axes */}
        {orderedTeams.length > 0 && followedCompetitions.length > 0 && (
          <div className="mx-1 my-2 w-px shrink-0 self-stretch bg-white/8" />
        )}

        {/* Competitions — brand glow carries their identity. (Click → Competition panel: later pass.) */}
        {followedCompetitions.map((comp) => (
          <CompetitionCard key={comp.id} comp={comp} />
        ))}

        {/* Follow — add a team (competition-add comes with the modal redesign) */}
        <button
          onClick={() => setAddOpen(true)}
          className={`${CARD_BASE} justify-center border border-dashed border-border-strong text-text-tertiary transition-colors hover:border-border-focus hover:text-text-secondary`}
        >
          <Plus size={18} />
          <span className="text-xs font-semibold">Follow</span>
        </button>
      </div>

      <FootballAddModal open={addOpen} onClose={() => setAddOpen(false)} />
    </section>
  );
}

// ─── Competition card ───────────────────────────────────────────────────────

function CompetitionCard({ comp }: { comp: FollowedCompetition }) {
  const logo = comp.logo_url || comp.emblem_url;
  const c = comp.brand_color;
  return (
    <div
      className={`${CARD_BASE} surface-card overflow-hidden${c ? " comp-glow-border" : ""}`}
      style={c ? ({ "--glow": c } as CSSProperties) : undefined}
    >
      {/* Fill: a soft downward wash rising from the bottom — low opacity + long fade so it's smooth,
          not a hard band. No colour climbs the sides. */}
      {c && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: `linear-gradient(to top, ${c}40, transparent 92%)` }}
        />
      )}
      <div className="relative h-9 w-9 shrink-0">
        {logo ? (
          <Image src={logo} alt={comp.name ?? "Competition"} fill sizes="36px" className="object-contain" />
        ) : (
          <div className="h-full w-full rounded-full" style={{ background: c ?? "var(--color-surface-2)" }} />
        )}
      </div>
      <span className="relative line-clamp-2 max-w-full text-center text-xs font-semibold leading-tight text-text-primary">
        {comp.name}
      </span>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function FollowingStripSkeleton() {
  return (
    <section>
      <div className="px-1 pb-2">
        <div className="h-4 w-24 rounded bg-white/5" />
      </div>
      <div className="flex gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-26 w-28 shrink-0 animate-pulse rounded-card bg-white/5" />
        ))}
      </div>
    </section>
  );
}
