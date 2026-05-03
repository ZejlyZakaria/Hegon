import F1ConstructorsStandingsSkeleton, {
  F1HeroSkeleton,
  F1CalendarSkeleton,
  F1RecentResultsSkeleton,
  F1DriversStandingsSkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function F1Loading() {
  return (
    <div className="p-6 space-y-6">
      <F1HeroSkeleton />
      <F1CalendarSkeleton />
      <F1RecentResultsSkeleton />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <F1DriversStandingsSkeleton />
        <F1ConstructorsStandingsSkeleton />
      </div>
    </div>
  );
}
