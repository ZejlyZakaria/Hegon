"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export interface Standing {
  team_id: string;
  competition_id: string;
  played_games: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  football_teams: { name: string; crest_url: string | null } | null;
}

export interface CompetitionStandings {
  competition: {
    id: string;
    name: string;
    code: string;
    emblem_url: string | null;
  };
  standings: Standing[];
}

interface StandingsTableProps {
  data: CompetitionStandings[];
  favoriteTeamIds: string[];
}

const COMPETITION_DISPLAY: Record<string, string> = {
  "Primera Division": "La Liga",
  "UEFA Champions League": "Champions League",
  "Premier League": "Premier League",
};

function displayName(name: string) {
  return COMPETITION_DISPLAY[name] ?? name;
}

function PositionIndicator({
  position,
  total,
}: {
  position: number;
  total: number;
}) {
  let color = "bg-zinc-700";
  if (position <= 4) color = "bg-blue-500";
  else if (position <= 6) color = "bg-orange-400";
  else if (position >= total - 2) color = "bg-red-500";
  return (
    <span className={`inline-block w-1 h-4 rounded-full ${color} shrink-0`} />
  );
}

function StandingRow({
  row,
  position,
  total,
  isFavorite,
  index,
}: {
  row: Standing;
  position: number;
  total: number;
  isFavorite: boolean;
  index: number;
}) {
  const gd = row.goal_difference;
  const gdFormatted = gd > 0 ? `+${gd}` : `${gd}`;
  const gdColor =
    gd > 0 ? "text-emerald-400" : gd < 0 ? "text-red-400" : "text-zinc-500";

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className={`group border-b border-zinc-800/50 transition-colors duration-150 ${
        isFavorite
          ? "bg-emerald-500/6 hover:bg-emerald-500/10"
          : "hover:bg-zinc-800/30"
      }`}
    >
      <td className="pl-4 pr-3 py-3 w-10">
        <div className="flex items-center gap-2">
          <PositionIndicator position={position} total={total} />
          <span
            className={`text-xs font-bold tabular-nums ${isFavorite ? "text-emerald-300" : "text-zinc-500"}`}
          >
            {position}
          </span>
        </div>
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center gap-2.5">
          {row.football_teams?.crest_url && (
            <div className="relative w-5 h-5 shrink-0">
              <Image
                src={row.football_teams.crest_url}
                alt={row.football_teams.name ?? ""}
                fill
                className="object-contain"
              />
            </div>
          )}
          <span
            className={`text-sm truncate max-w-32.5 md:max-w-none font-medium ${isFavorite ? "text-white font-semibold" : "text-zinc-300"}`}
          >
            {row.football_teams?.name}
          </span>
          {isFavorite && (
            <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
              ★
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 text-center text-xs text-zinc-500 tabular-nums w-10">
        {row.played_games}
      </td>
      <td className="px-2 py-3 text-center text-xs text-zinc-400 tabular-nums w-10 hidden sm:table-cell">
        {row.won}
      </td>
      <td className="px-2 py-3 text-center text-xs text-zinc-500 tabular-nums w-10 hidden sm:table-cell">
        {row.draw}
      </td>
      <td className="px-2 py-3 text-center text-xs text-zinc-500 tabular-nums w-10 hidden sm:table-cell">
        {row.lost}
      </td>
      <td
        className={`px-2 py-3 text-center text-xs tabular-nums w-10 hidden md:table-cell ${gdColor}`}
      >
        {gdFormatted}
      </td>
      <td className="px-3 py-3 text-center w-12">
        <span
          className={`text-sm font-black tabular-nums ${isFavorite ? "text-emerald-400" : "text-white"}`}
        >
          {row.points}
        </span>
      </td>
    </motion.tr>
  );
}

function Legend({ isChampionsLeague }: { isChampionsLeague: boolean }) {
  if (isChampionsLeague) {
    return (
      <div className="px-4 py-3 border-t border-zinc-800/50 flex flex-wrap gap-x-5 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1 h-3 rounded-full bg-blue-500" />
          <span className="text-zinc-600 text-[11px]">
            Qualified for next round
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1 h-3 rounded-full bg-red-500" />
          <span className="text-zinc-600 text-[11px]">Eliminated</span>
        </div>
        <span className="text-zinc-700 text-[11px] ml-auto italic">
          Group Phase
        </span>
      </div>
    );
  }
  return (
    <div className="px-4 py-3 border-t border-zinc-800/50 flex flex-wrap gap-x-5 gap-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 rounded-full bg-blue-500" />
        <span className="text-zinc-600 text-[11px]">Champions League</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 rounded-full bg-orange-400" />
        <span className="text-zinc-600 text-[11px]">Europa League</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 rounded-full bg-red-500" />
        <span className="text-zinc-600 text-[11px]">Relégation</span>
      </div>
    </div>
  );
}

export default function StandingsTableInner({
  data,
  favoriteTeamIds,
}: StandingsTableProps) {
  const [activeTab, setActiveTab] = useState(0);
  if (!data.length) return null;

  const active = data[activeTab];
  const isChampionsLeague = active.competition.code === "CL";
  const sorted = [...active.standings].sort((a, b) =>
    b.points !== a.points
      ? b.points - a.points
      : b.goal_difference - a.goal_difference,
  );

  return (
    <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-3 border-b border-zinc-800/60 overflow-x-auto scrollbar-none">
        {data.map((comp, i) => {
          const isActive = i === activeTab;
          return (
            <button
              key={comp.competition.id}
              onClick={() => setActiveTab(i)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 ${isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {isActive && (
                <motion.div
                  layoutId="standings-tab-bg"
                  className="absolute inset-0 bg-zinc-800 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {comp.competition.emblem_url && (
                  <div className="w-6 h-6 shrink-0 bg-white rounded-sm p-1 flex items-center justify-center">
                    <div className="relative w-full h-full">
                      <Image
                        src={comp.competition.emblem_url}
                        alt={comp.competition.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
                {displayName(comp.competition.name)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-x-auto"
        >
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="border-b border-zinc-800/60">
                <th className="pl-4 pr-3 py-2.5 text-left w-10">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    #
                  </span>
                </th>
                <th className="px-2 py-2.5 text-left">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    Team
                  </span>
                </th>
                <th className="pr-6 py-2.5 text-center w-10">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    MP
                  </span>
                </th>
                <th className="pr-6 py-2.5 text-center w-10 hidden sm:table-cell">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    W
                  </span>
                </th>
                <th className="pr-6 py-2.5 text-center w-10 hidden sm:table-cell">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    D
                  </span>
                </th>
                <th className="pr-6 py-2.5 text-center w-10 hidden sm:table-cell">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    L
                  </span>
                </th>
                <th className="pr-6 py-2.5 text-center w-10 hidden md:table-cell">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    GD
                  </span>
                </th>
                <th className="pr-6 py-2.5 text-center w-12">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
                    Pts
                  </span>
                </th>
              </tr>
            </thead>
          </table>
          <div className="overflow-y-auto max-h-72 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700 custom-scrollbar">
            <table className="w-full">
              <tbody>
                {sorted.map((row, i) => (
                  <StandingRow
                    key={row.team_id}
                    row={row}
                    position={i + 1}
                    total={sorted.length}
                    isFavorite={favoriteTeamIds.includes(row.team_id)}
                    index={i}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </AnimatePresence>

      <Legend isChampionsLeague={isChampionsLeague} />
    </div>
  );
}
