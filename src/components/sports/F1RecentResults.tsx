/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";

interface RecentResult {
  id: string;
  race_name: string;
  race_date: string;
  round: number;
  season: number;
  f1_circuits: {
    circuit_name: string;
    locality: string;
    country: string;
    country_code: string;
    circuit_svg_url: string | null;
  };
  podium: {
    p1: {
      driver_name: string;
      team_color: string;
      team_logo: string | null;
      team_name: string | null;
    };
    p2: { driver_name: string };
    p3: { driver_name: string };
  };
  stats: {
    total_laps: number;
    fastest_lap_time: string;
    fastest_lap_driver: string;
  };
}

function formatRaceDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function F1RecentResults({
  results,
}: {
  results: RecentResult[];
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-red-600 to-red-400" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Derniers Résultats
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result, index) => {
          const teamColor = result.podium.p1.team_color;

          return (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="group relative overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/30 transition-colors duration-300"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                borderColor: `${teamColor}00`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${teamColor}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${teamColor}00`;
              }}
            >
              {/* Glow avec couleur équipe au hover */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(ellipse at top, ${teamColor}15, transparent 70%)`,
                }}
              />

              {/* Logo équipe P1 en watermark */}
              {/* {result.podium.p1.team_logo && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style={{ opacity: 0.05 }}
                >
                  <img
                    src={result.podium.p1.team_logo}
                    alt=""
                    className="h-48 w-48 object-contain"
                    style={{
                      filter: "brightness(0) invert(1)",
                      opacity: 0.5,
                    }}
                  />
                </div>
              )} */}
              {result.podium.p1.team_logo && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style={{ opacity: 0.05 }}
                >
                  <img
                    src={
                      result.podium.p1.team_name === "Ferrari"
                        ? "/assets/f1/teams/ferrari-white.png"
                        : result.podium.p1.team_logo
                    }
                    alt=""
                    className="h-48 w-48 object-contain"
                    style={{
                      filter:
                        result.podium.p1.team_name === "Ferrari"
                          ? "none"
                          : "brightness(0) invert(1)",
                      opacity: 0.5,
                    }}
                  />
                </div>
              )}

              {/* Top accent permanent avec couleur équipe */}
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${teamColor}40, transparent)`,
                }}
              />

              {/* Badge Round en haut à droite */}
              <div className="absolute top-3 right-3 z-20">
                <div
                  className="relative text-white px-2.5 py-1 rounded-t-md"
                  style={{ backgroundColor: `${teamColor}80` }}
                >
                  <span className="text-xs font-black tracking-wider">
                    R{result.round}
                  </span>
                  {/* Triangle bookmark */}
                  <div className="absolute left-0 right-0 -bottom-1.5 flex justify-center">
                    <div
                      className="w-0 h-0"
                      style={{
                        borderLeft: "10px solid transparent",
                        borderRight: "10px solid transparent",
                        borderTop: `6px solid ${teamColor}80`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6">
                {/* SECTION 1: Header GP */}
                <div className="flex flex-col gap-2 max-w-[80%]">
                  <h3 className="line-clamp-2 text-sm font-light uppercase tracking-[.15rem] text-white leading-tight">
                    {result.race_name}
                  </h3>
                  <p className="text-[11px] sm:text-xs font-light uppercase tracking-[.15rem] text-zinc-500">
                    {formatRaceDate(result.race_date)}
                  </p>
                </div>

                {/* SECTION 2: Podium + Circuit SVG */}
                <div className="flex items-center justify-between gap-2 min-h-30 sm:min-h-35">
                  {/* LEFT: Podium P1, P2, P3 */}
                  <div className="flex-1 min-w-0 max-w-[60%] flex flex-col justify-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500 font-black text-sm">
                        P1
                      </span>
                      <span className="text-white font-bold text-sm truncate">
                        {result.podium.p1.driver_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-black text-sm">
                        P2
                      </span>
                      <span className="text-white text-sm truncate">
                        {result.podium.p2.driver_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600  font-black text-sm">
                        P3
                      </span>
                      <span className="text-white text-sm truncate">
                        {result.podium.p3.driver_name}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: Circuit SVG */}
                  {result.f1_circuits.circuit_svg_url && (
                    <div className="flex h-28 w-36  sm:h-24.5 sm:w-18  md:h24 md:w-20  lg:h-18 lg:w-18  xl:h-34 xl:w-32 shrink-0 items-center justify-center">
                      <img
                        src={result.f1_circuits.circuit_svg_url}
                        alt={result.f1_circuits.circuit_name}
                        className="max-h-full max-w-full object-contain"
                        style={{
                          filter:
                            "hue-rotate(180deg) saturate(3) brightness(1.2) drop-shadow(0 0 6px rgba(127,29,29,0.4))",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* SECTION 3: Stats Footer */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 min-h-12">
                  {/* Laps */}
                  <div className="flex flex-col justify-center">
                    <p className="mb-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">
                      Laps
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-white tabular-nums">
                      {result.stats.total_laps}
                    </p>
                  </div>

                  {/* Fastest Lap */}
                  <div className="flex flex-col justify-center">
                    <p className="mb-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">
                      Fastest
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-white tabular-nums">
                      {result.stats.fastest_lap_time}
                    </p>
                  </div>

                  {/* FL Driver */}
                  <div className="flex flex-col justify-center">
                    <p className="mb-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">
                      FL
                    </p>
                    <p className="truncate text-xs sm:text-sm font-bold text-white">
                      {result.stats.fastest_lap_driver}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
