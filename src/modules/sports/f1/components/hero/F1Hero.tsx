/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, Flag } from "lucide-react";

export interface F1HeroData {
  race: {
    id: string;
    name: string;
    round: number;
    season: number;
    raceDate: string;
    raceTime: string | null;
    qualiDate: string | null;
    qualiTime: string | null;
  };
  circuit: {
    name: string;
    locality: string;
    country: string;
    countryCode: string;
    svgUrl: string | null;
  };
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date();
  const difference = targetDate.getTime() - now.getTime();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

function formatDateTime(date: string | null, time: string | null): string {
  if (!date) return "";

  const d = new Date(date);
  const formatted = d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (time) {
    const timeFormatted = time.slice(0, 5);
    return `${formatted} à ${timeFormatted}`;
  }

  return formatted;
}

export default function F1Hero({ heroData }: { heroData: F1HeroData }) {
  const { race, circuit } = heroData;

  const raceDateTime = useMemo(
    () => new Date(`${race.raceDate}T${race.raceTime || "14:00:00"}Z`),
    [race.raceDate, race.raceTime],
  );

  // ✅ FIX HYDRATION: Initialiser avec null et calculer côté client
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft(raceDateTime));
    }, 0);

    // Puis mettre à jour chaque seconde
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(raceDateTime));
    }, 1000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(timer);
    };
  }, [raceDateTime]);

  return (
    <div className="relative h-72 md:h-60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
      {/* Label "Prochaine course" */}
      <div className="absolute top-4 left-4 z-10">
        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
          Next Race
        </span>
      </div>

      {/* Background image */}
      <div className="absolute inset-0 bg-zinc-900" />
      <Image
        src="/assets/f1/background/F1_track.png"
        alt="F1 Circuit"
        fill
        priority
        className="object-cover object-center opacity-50"
        quality={75}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-black/50 via-transparent to-transparent" />

      {/* Content - Layout gauche/droite comme Tennis */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-between h-full p-4 md:p-8 gap-6 md:gap-4 pt-10 md:pt-8">
        {/* GAUCHE - Info course + circuit */}
        <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}
            className="relative flex items-center justify-center w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full overflow-hidden border-2 border-red-500/50 shadow-xl bg-zinc-900/80 backdrop-blur-sm"
          >
            <img
              src="/assets/f1/background/F1.svg"
              alt="F1 Logo"
              className="w-3/4 h-3/4 object-contain"
            />
          </motion.div>

          <div>
            {/* Badge Round */}
            <motion.span
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="text-xs font-bold text-red-400 tracking-widest"
            >
              ROUND {race.round} • {race.season}
            </motion.span>

            {/* Nom GP */}
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="text-2xl md:text-4xl font-extrabold tracking-tight text-white"
            >
              {race.name}
            </motion.h2>

            {/* Circuit + Pays */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              className="flex items-center gap-3 mt-1 justify-center md:justify-start"
            >
              <img
                src={`/assets/flags/${circuit.country.toLowerCase()}.svg`}
                alt={circuit.country}
                width={20}
                height={14}
                className="shadow-sm"
              />
              <span className="text-zinc-400 text-sm">{circuit.name}</span>
              <div className="flex items-center gap-1 bg-red-500/15 border border-red-500/30 rounded-full px-2.5 py-0.5">
                <Flag size={11} className="text-red-400" />
                <span className="text-red-400 text-xs font-black">
                  {circuit.locality}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* DROITE - Countdown + Dates */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex flex-col items-center md:items-end text-center md:text-right gap-3"
        >
          {/* Countdown compact */}
          <div className="flex gap-2">
            {[
              { label: "J", value: timeLeft?.days ?? 0 },
              { label: "H", value: timeLeft?.hours ?? 0 },
              { label: "M", value: timeLeft?.minutes ?? 0 },
              { label: "S", value: timeLeft?.seconds ?? 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5 min-w-11"
              >
                <div className="text-xl font-black text-red-400 tabular-nums">
                  {String(item.value).padStart(2, "0")}
                </div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Dates Quali + Race */}
          <div className="flex flex-col gap-1.5 text-xs">
            {race.qualiDate && (
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Calendar size={11} className="text-yellow-500" />
                <span className="font-semibold text-yellow-500">Quali :</span>
                <span>{formatDateTime(race.qualiDate, race.qualiTime)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Calendar size={11} className="text-red-500" />
              <span className="font-semibold text-red-500">Course :</span>
              <span>{formatDateTime(race.raceDate, race.raceTime)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
