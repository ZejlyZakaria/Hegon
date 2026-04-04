/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/football/FootballXISection.tsx
import { Suspense } from "react";
import BestXI from "./BestXI";
import FootballLegendsServer from "./FootballLegendsServer";

interface Props {
  userId: string;
  initialFormation: string;
  initialPlayers: any[];
  bestXiId: string | null;
}

function LegendsSkeleton() {
  return (
    <div className="flex flex-col gap-3 h-full animate-pulse">
      <div className="grid grid-cols-3 gap-1.5" style={{ height: "60%" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-zinc-800/50" />
        ))}
      </div>
      <div className="h-px bg-zinc-800" />
      <div className="flex-1 bg-zinc-900/30 rounded-xl" />
    </div>
  );
}

export default function FootballXISection({
  userId,
  initialFormation,
  initialPlayers,
  bestXiId,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
      {/* moitié gauche — BestXI */}
      <div className="w-full flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            My favorite Best XI
          </h2>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <BestXI
          userId={userId}
          initialFormation={initialFormation}
          initialPlayers={initialPlayers}
          bestXiId={bestXiId}
        />
      </div>

      {/* moitié droite — Légendes */}
      <div className="w-full flex flex-col gap-3">
        {/* titre */}
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            My Legends Cards
          </h2>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-4 flex-1">
          <Suspense fallback={<LegendsSkeleton />}>
            <FootballLegendsServer userId={userId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
