"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFootballTeams } from "../../hooks/useFootballTeams";
import { useUpcomingMatches } from "../../hooks/useFootballMatches";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { FootballMatchCard } from "../FootballMatchCard";

type Chip = { id: string; name: string; crest_url: string | null; api_external_id: string; isMain: boolean };

// Upcoming matches for the followed teams — its OWN queries (teams + matches from football_matches),
// independent of the page monolith. Team-filter chips filter the row; every card opens the sliding
// match panel.
export default function FootballUpcomingSection() {
  const userId = useCurrentUserId();
  const { data: teams } = useFootballTeams(userId);
  const open = useMatchPanel((s) => s.open);

  const followed = useMemo<Chip[]>(() => {
    if (!teams) return [];
    const list: Chip[] = [];
    if (teams.mainTeam) list.push({ ...teams.mainTeam, isMain: true });
    for (const t of teams.otherFavoriteTeams) list.push({ ...t, isMain: false });
    return list;
  }, [teams]);

  const extIds = useMemo(() => followed.map((t) => t.api_external_id), [followed]);
  const { data: matches = [], isLoading } = useUpcomingMatches(extIds);

  const [active, setActive] = useState<string>("all");
  const shown = active === "all"
    ? matches
    : matches.filter((m) => m.home_external_id === active || m.away_external_id === active);

  // Per-section empty rule: no follows, or nothing upcoming → the section doesn't render at all.
  if (!followed.length) return null;
  if (!isLoading && matches.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1 w-10 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Upcoming</h2>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      {/* team filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActive("all")}
          className={`shrink-0 rounded-control border border-border-subtle px-3 py-2 text-xs font-semibold transition-colors ${
            active === "all" ? "bg-surface-2 text-text-primary" : "bg-surface-1 text-text-tertiary hover:text-text-secondary"
          }`}
        >
          All
        </button>
        {followed.map((t) => {
          const count = matches.filter((m) => m.home_external_id === t.api_external_id || m.away_external_id === t.api_external_id).length;
          const isActive = active === t.api_external_id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.api_external_id)}
              className={`flex shrink-0 items-center gap-2 rounded-control border border-border-subtle px-3 py-2 transition-colors ${
                isActive ? "bg-surface-2 text-text-primary" : "bg-surface-1 text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t.crest_url && (
                // eslint-disable-next-line @next/next/no-img-element -- small external crest
                <img src={t.crest_url} alt="" className="h-5 w-5 object-contain" />
              )}
              <span className="whitespace-nowrap text-xs font-semibold">{t.name}</span>
              {t.isMain && <span className="text-[10px] text-emerald-400">★</span>}
              {count > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-text-tertiary tabular-nums">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-[190px] animate-pulse rounded-card bg-surface-1" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {shown.map((m) => <FootballMatchCard key={m.external_match_id} match={m} onOpen={open} />)}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
