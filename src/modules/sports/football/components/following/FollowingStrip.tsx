"use client";

// The Following strip — the top section of the Football page. It is a LAUNCHER, not a filter:
//   · a card per followed team (1st axis, user_favorites) → opens the Team Panel on click,
//   · followed competitions (2nd axis) after a divider, each carrying its brand glow,
//   · a trailing "Follow" card to add.
// Main team stands out by MATERIAL (graphite raised surface) + a star, never by a border or a label
// that would shift the row's alignment. Removal lives in the Team Panel (not here).
// Data is its own concern: useFootballTeams + useFollowedCompetitions (no page monolith).

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useFollowedCompetitions } from "../../hooks/useFollowedCompetitions";
import type { FootballTeam } from "../../types";
import { displayCompetitionName } from "../../service";
import type { FollowedCompetition } from "../../service";
import FootballAddModal from "../modals/FootballAddModal";

const CREST_FALLBACK = "/placeholder-logo.svg";
const CARD_BASE = "relative flex w-28 min-h-26 shrink-0 flex-col items-center gap-2 rounded-card px-3 pb-3 pt-4 transition-all";

export default function FollowingStrip() {
  const userId = useCurrentUserId();

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByDir = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });

  if (teamsLoading && !teams) return <FollowingStripSkeleton />;

  return (
    <section>
      <SectionHeader
        title="Following"
        subtitle="Teams and competitions you follow"
        actions={
          <>
            <CarouselNav onPrev={() => scrollByDir(-1)} onNext={() => scrollByDir(1)} />
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent-sports px-3 text-xs font-bold text-accent-sports-deep transition-colors hover:bg-accent-sports/90"
            >
              <Plus size={15} />
              Add
            </button>
          </>
        }
      />

      {/* Cards scroll horizontally; the header arrows drive it. py-2 -my-2 gives room for the hover lift. */}
      <div ref={scrollRef} className="scrollbar-hide flex items-stretch gap-2.5 overflow-x-auto py-2 -my-2">
        {/* Teams — click opens the Team page */}
        {orderedTeams.map(({ team, isMain }) => (
            <Link
              key={team.id}
              href={`/perso/sports/football/team/${team.api_external_id}`}
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
            </Link>
          ))}

          {/* Divider between the two follow axes */}
          {orderedTeams.length > 0 && followedCompetitions.length > 0 && (
            <div className="mx-1 my-2 w-px shrink-0 self-stretch bg-white/8" />
          )}

        {/* Competitions — brand glow carries their identity. (Click → Competition panel: later pass.) */}
        {followedCompetitions.map((comp) => (
          <CompetitionCard key={comp.id} comp={comp} />
        ))}
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
    <Link
      href={`/perso/sports/football/competition/${comp.id}`}
      className={`${CARD_BASE} surface-card overflow-hidden${c ? " comp-glow-border" : ""} hover:-translate-y-0.5`}
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
        {displayCompetitionName(comp.name)}
      </span>
    </Link>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function FollowingStripSkeleton() {
  return (
    <section>
      <div className="mb-3 space-y-1.5">
        <div className="h-5 w-28 rounded bg-white/5" />
        <div className="h-3 w-44 rounded bg-white/5" />
      </div>
      <div className="flex gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-26 w-28 shrink-0 animate-pulse rounded-card bg-white/5" />
        ))}
      </div>
    </section>
  );
}
