/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

interface CalendarRace {
  id: string;
  race_name: string;
  race_date: string;
  race_time: string | null;
  round: number;
  season: number;
  f1_circuits: {
    circuit_name: string;
    locality: string;
    country: string;
    country_code: string;
    circuit_svg_url: string | null;
    circuit_length_km: number | null;
    total_laps: number | null;
    last_winner_driver_id: string | null;
    last_winner_year: number | null;
    f1_drivers: {
      full_name: string;
    } | null;
  };
}

function formatRaceDate(dateStr: string, timeStr: string | null): string {
  const date = new Date(dateStr);

  const formatted = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (timeStr) {
    const [hours, minutes] = timeStr.split(":");
    return `${formatted} - ${hours}:${minutes}`;
  }

  return formatted;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const raceDate = new Date(dateStr);
  const diff = raceDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function F1Calendar({ races }: { races: CalendarRace[] }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-red-600 to-red-400" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Prochaine Courses
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map((race, index) => {
          const daysUntil = getDaysUntil(race.race_date);

          return (
            <motion.div
              key={race.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="group relative overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/30 transition-colors duration-300 hover:border-red-500/50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            >
              {/* Glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(ellipse at top, rgba(239,68,68,0.06), transparent 70%)",
                }}
              />

              {/* Top accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/25 to-transparent" />
              {/* Round number */}
              <div className="absolute top-3 right-3 z-20">
                <div className="relative bg-red-600 text-white px-2.5 py-1 rounded-t-md">
                  <span className="text-xs font-black tracking-wider">
                    R{race.round}
                  </span>
                  {/* Triangle en bas pour effet bookmark */}
                  <div className="absolute left-0 right-0 -bottom-1.5 flex justify-center">
                    <div
                      className="w-0 h-0"
                      style={{
                        borderLeft: "10px solid transparent",
                        borderRight: "10px solid transparent",
                        borderTop: "6px solid #dc2626", // red-600
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6">
                {/* SECTION 1 */}
                <div className="flex flex-col gap-2 max-w-[80%]">
                  <h3 className="line-clamp-2 text-sm font-light uppercase tracking-[.15rem] text-white leading-tight">
                    {race.race_name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <p className="text-[11px] sm:text-xs font-light uppercase tracking-[.15rem] text-zinc-500">
                      {formatRaceDate(race.race_date, race.race_time)}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-amber-500" />
                      <span className="text-[11px] sm:text-xs font-light tracking-[.12rem] text-amber-500">
                        Dans {daysUntil}j
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className="flex items-center justify-between gap-2 min-h-30 sm:min-h-35">
                  {/* LEFT */}
                  <div className="flex min-w-0 flex-1 max-w-[60%] flex-col justify-center gap-2">
                    <div className="w-10">
                      <img
                        src="/assets/f1/background/F1.svg"
                        alt="F1 Logo"
                        width={40}
                        height={88}
                        className="w-full"
                        style={{ height: "auto" }}
                      />
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-white leading-tight wrap-break-word">
                      {race.f1_circuits.circuit_name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-zinc-400">
                      <span className="truncate">
                        {race.f1_circuits.locality}
                      </span>

                      <span className="hidden sm:inline">•</span>

                      <span className="truncate">
                        {race.f1_circuits.country}
                      </span>

                      {race.f1_circuits.country_code &&
                        race.f1_circuits.country_code !== "XX" && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <img
                              src={`/assets/flags/${race.f1_circuits.country.toLowerCase()}.svg`}
                              alt={race.f1_circuits.country}
                              width={18}
                              height={16}
                              className="h-3 w-auto shrink-0 shadow-sm"
                            />
                          </>
                        )}
                    </div>
                  </div>

                  {/* RIGHT */}
                  {race.f1_circuits.circuit_svg_url && (
                    <div className="flex h-28 w-36  sm:h-24.5 sm:w-18  md:h24 md:w-20  lg:h-18 lg:w-18  xl:h-34 xl:w-32 shrink-0 items-center justify-center">
                      <img
                        src={race.f1_circuits.circuit_svg_url}
                        alt={race.f1_circuits.circuit_name}
                        className="max-h-full max-w-full object-contain"
                        style={{
                          filter:
                            "hue-rotate(180deg) saturate(3) brightness(1.2) drop-shadow(0 0 6px rgba(127,29,29,0.4))",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* SECTION 3 */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 min-h-12">
                  <div className="flex flex-col justify-center">
                    <p className="mb-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">
                      Laps
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-white tabular-nums">
                      {race.f1_circuits.total_laps || "-"}
                    </p>
                  </div>

                  <div className="flex flex-col justify-center">
                    <p className="mb-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">
                      Length
                    </p>
                    <p className="truncate text-xs sm:text-sm font-bold text-white tabular-nums">
                      {race.f1_circuits.circuit_length_km
                        ? `${race.f1_circuits.circuit_length_km}km`
                        : "-"}
                    </p>
                  </div>

                  <div className="flex flex-col justify-center">
                    <p className="mb-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">
                      Winner
                    </p>
                    <p className="truncate text-xs sm:text-sm font-bold text-white">
                      {race.f1_circuits.f1_drivers?.full_name ? (
                        race.f1_circuits.f1_drivers.full_name
                      ) : race.f1_circuits.circuit_name === "Madring" ? (
                        <span className="whitespace-nowrap text-[9px] sm:text-[10px] font-bold text-amber-500">
                          🆕 NEW
                        </span>
                      ) : (
                        "-"
                      )}
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
