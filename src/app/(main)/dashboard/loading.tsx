function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-800/60 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#09090b] overflow-y-auto">
      <div className="px-6 py-5 flex flex-col gap-6">

        {/* Header */}
        <div className="py-2 flex flex-col gap-2">
          <Pulse className="h-3 w-20 rounded-md" />
          <Pulse className="h-8 w-60 rounded-lg" />
        </div>

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* TodaySection — 3-col grid */}
            <Pulse className="h-36" />

            {/* GoalsBooksRow — 3 equal cards */}
            <div className="flex gap-4">
              <Pulse className="flex-1 h-28" />
              <Pulse className="flex-1 h-28" />
              <Pulse className="flex-1 h-28" />
            </div>

            {/* MediaSportsRow — 4 equal cards */}
            <div className="grid grid-cols-4 gap-4">
              <Pulse className="h-44" />
              <Pulse className="h-44" />
              <Pulse className="h-44" />
              <Pulse className="h-44" />
            </div>

          </div>

          {/* Right panel */}
          <div className="w-72 shrink-0 flex flex-col gap-4">
            <Pulse className="h-36" />
            <Pulse className="h-44" />
            <Pulse className="h-44" />
          </div>
        </div>

      </div>
    </div>
  );
}
