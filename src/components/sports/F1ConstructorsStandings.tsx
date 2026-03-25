/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";

export interface ConstructorStanding {
  position: number;
  team_id: string;
  points: number;
  wins: number;
  podiums: number;
  f1_teams: {
    name: string;
    color_primary: string;
    logo_url: string | null;
  } | null;
}

interface F1ConstructorsStandingsProps {
  standings: ConstructorStanding[];
}

function PositionIndicator({ position }: { position: number }) {
  let color = "bg-zinc-700";
  if (position === 1)
    color = "bg-yellow-500"; // Champion
  else if (position <= 3)
    color = "bg-blue-500"; // Podium
  else if (position <= 10) color = "bg-emerald-500"; // Points zone

  return (
    <span className={`inline-block w-1 h-4 rounded-full ${color} shrink-0`} />
  );
}

function StandingRow({
  row,
  index,
}: {
  row: ConstructorStanding;
  index: number;
}) {
  const teamColor = row.f1_teams?.color_primary || "#ef4444";
  const isTopThree = row.position <= 3;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="group border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors duration-150"
    >
      {/* Position */}
      <td className="pl-4 pr-3 py-3 w-12">
        <div className="flex items-center gap-2">
          <PositionIndicator position={row.position} />
          <span
            className={`text-xs font-bold tabular-nums ${
              isTopThree ? "text-white" : "text-zinc-500"
            }`}
          >
            {row.position}
          </span>
        </div>
      </td>

      {/* Team Name */}
      <td className="px-2 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`text-sm font-medium ${
              isTopThree ? "text-white font-semibold" : "text-zinc-300"
            }`}
          >
            {row.f1_teams?.name || "Unknown"}
          </span>
        </div>
      </td>

      {/* Team Logo */}
      <td className="px-2 py-3">
        <div className="flex items-center gap-2">
          {row.f1_teams?.logo_url && (
            <div className="relative w-5 h-5 shrink-0">
              <img
                src={
                  row.f1_teams.name === "Ferrari"
                    ? "/assets/f1/teams/ferrari-white.png"
                    : row.f1_teams.name === "Cadillac F1 Team"
                      ? "/assets/f1/teams/cadillac.png"
                      : row.f1_teams.logo_url
                }
                alt={row.f1_teams.name}
                className="w-full h-full object-contain"
                style={{
                  filter:
                    row.f1_teams.name === "Ferrari" ||
                    row.f1_teams.name === "Cadillac F1 Team"
                      ? "none"
                      : "brightness(0) invert(1)",
                }}
              />
            </div>
          )}
          <span className="text-xs text-zinc-400 truncate max-w-24 sm:max-w-none">
            {row.f1_teams?.name || "-"}
          </span>
        </div>
      </td>

      {/* Wins */}
      <td className="px-2 py-3 text-center text-xs text-zinc-400 tabular-nums w-12 hidden sm:table-cell">
        {row.wins}
      </td>

      {/* Podiums */}
      <td className="px-2 py-3 text-center text-xs text-zinc-400 tabular-nums w-12 hidden md:table-cell">
        {row.podiums}
      </td>

      {/* Points */}
      <td className="px-3 py-3 text-center w-16">
        <span
          className="text-sm font-black tabular-nums"
          style={{ color: isTopThree ? teamColor : "#fff" }}
        >
          {row.points}
        </span>
      </td>
    </motion.tr>
  );
}

function Legend() {
  return (
    <div className="px-4 py-3 border-t border-zinc-800/50 flex flex-wrap gap-x-5 gap-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 rounded-full bg-yellow-500" />
        <span className="text-zinc-600 text-[11px]">Champion</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 rounded-full bg-blue-500" />
        <span className="text-zinc-600 text-[11px]">Podium</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 rounded-full bg-emerald-500" />
        <span className="text-zinc-600 text-[11px]">Top 10 (Points)</span>
      </div>
    </div>
  );
}

export default function F1ConstructorsStandings({
  standings,
}: F1ConstructorsStandingsProps) {
  if (!standings.length) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-red-600 to-red-400" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Classement Constructeurs
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Table Container */}
      <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="border-b border-zinc-800/60">
                <th className="pl-4 pr-3 py-2.5 text-left w-12">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    #
                  </span>
                </th>
                <th className="px-2 py-2.5 text-left">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    Équipe
                  </span>
                </th>
                <th className="px-1 py-2.5 text-left">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    Logo
                  </span>
                </th>
                <th className="px-2 py-2.5 text-center w-12 hidden sm:table-cell">
                  <span className="mr-2 text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    V
                  </span>
                </th>
                <th className="px-2 py-2.5 text-center w-12 hidden md:table-cell">
                  <span className="mr-3 text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                    Pod
                  </span>
                </th>
                <th className="px-3 py-2.5 text-center w-16 ">
                  <span className="mr-6 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
                    Pts
                  </span>
                </th>
              </tr>
            </thead>
          </table>

          {/* Table Body with scroll */}
          <div className="overflow-y-auto max-h-96 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
            <table className="w-full">
              <tbody>
                {standings.map((row, i) => (
                  <StandingRow key={row.team_id} row={row} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <Legend />
      </div>
    </div>
  );
}
