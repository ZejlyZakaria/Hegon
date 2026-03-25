// components/sports/f1/F1PageWrapper.tsx
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import F1HeroSection from "@/components/sports/f1/F1HeroSection";
import F1CalendarSection from "@/components/sports/f1/F1CalendarSection";
import F1RecentResultsSection from "@/components/sports/f1/F1RecentResultsSection";
import F1DriversStandingsSection from "@/components/sports/f1/F1DriversStandingsSection";
import F1ConstructorsStandingsSkeleton, {
  F1HeroSkeleton,
  F1CalendarSkeleton,
  F1RecentResultsSkeleton,
  F1DriversStandingsSkeleton,
} from "@/components/sports/SportSkeletons";
import F1ConstructorsStandingsSection from "./F1ConstructorsStandingsSection";

export default async function F1PageWrapper() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-zinc-500">
        Connecte-toi pour voir ton hub F1.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 1️⃣ Hero — Prochaine course + countdown */}
      <Suspense fallback={<F1HeroSkeleton />}>
        <F1HeroSection userId={user.id} />
      </Suspense>

      {/* 2️⃣ Calendrier — 3 prochains GP */}
      <Suspense fallback={<F1CalendarSkeleton />}>
        <F1CalendarSection userId={user.id} />
      </Suspense>

      {/* 3️⃣ Résultats récents — 3 derniers GP */}
      <Suspense fallback={<F1RecentResultsSkeleton />}>
        <F1RecentResultsSection userId={user.id} />
      </Suspense>

      {/* 4️⃣ Classement Pilotes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<F1DriversStandingsSkeleton />}>
          <F1DriversStandingsSection userId={user.id} />
        </Suspense>

        <Suspense fallback={<F1ConstructorsStandingsSkeleton />}>
          <F1ConstructorsStandingsSection userId={user.id} />
        </Suspense>
      </div>
    </div>
  );
}
