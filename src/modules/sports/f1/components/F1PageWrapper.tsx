import { Suspense } from "react";
import { createServerClient } from "@/infrastructure/supabase/server";
import F1HeroSection from "./hero/F1HeroSection";
import F1CalendarSection from "./calendar/F1CalendarSection";
import F1RecentResultsSection from "./results/F1RecentResultsSection";
import F1DriversStandingsSection from "./standings/F1DriversStandingsSection";
import F1ConstructorsStandingsSection from "./standings/F1ConstructorsStandingsSection";
import F1ConstructorsStandingsSkeleton, {
  F1HeroSkeleton,
  F1CalendarSkeleton,
  F1RecentResultsSkeleton,
  F1DriversStandingsSkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default async function F1PageWrapper() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-zinc-500">
        Connecte-toi pour voir ton hub F1.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Suspense fallback={<F1HeroSkeleton />}>
        <F1HeroSection />
      </Suspense>

      <Suspense fallback={<F1CalendarSkeleton />}>
        <F1CalendarSection />
      </Suspense>

      <Suspense fallback={<F1RecentResultsSkeleton />}>
        <F1RecentResultsSection />
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<F1DriversStandingsSkeleton />}>
          <F1DriversStandingsSection />
        </Suspense>

        <Suspense fallback={<F1ConstructorsStandingsSkeleton />}>
          <F1ConstructorsStandingsSection />
        </Suspense>
      </div>
    </div>
  );
}
