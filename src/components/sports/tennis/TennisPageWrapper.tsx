// components/sports/tennis/TennisPageWrapper.tsx
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import TennisHeroSection from "@/components/sports/tennis/TennisHeroSection";
import TennisRecentResultsSection from "@/components/sports/tennis/TennisRecentResultsSection";
import TennisRankingsSection from "@/components/sports/tennis/TennisRankingsSection";
import TennisUpcomingSection from "@/components/sports/tennis/TennisUpcomingSection";
import {
  TennisRecentResultsSkeleton,
  TennisRankingsSkeleton,
  TennisHeroSkeleton,
  TennisUpcomingSkeleton,
} from "@/components/sports/SportSkeletons";

export default async function TennisPageWrapper() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-zinc-500">
        Connecte-toi pour voir ton hub Tennis.
      </div>
    );
  }

  // ✅ On passe juste userId, chaque section fetch ses propres données en parallèle
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 1️⃣ Hero — charge en PREMIER */}
      <Suspense fallback={<TennisHeroSkeleton />}>
        <TennisHeroSection userId={user.id} />
      </Suspense>

      {/* 2️⃣ Prochains tournois — charge APRÈS Hero */}
      <Suspense fallback={<TennisUpcomingSkeleton />}>
        <TennisUpcomingSection userId={user.id} />
      </Suspense>

      {/* 3️⃣ Résultats récents — charge APRÈS Tournois */}
      <Suspense fallback={<TennisRecentResultsSkeleton />}>
        <TennisRecentResultsSection userId={user.id} />
      </Suspense>

      {/* 4️⃣ Classement ATP — charge en DERNIER */}
      <Suspense fallback={<TennisRankingsSkeleton />}>
        <TennisRankingsSection userId={user.id} />
      </Suspense>
    </div>
  );
}
