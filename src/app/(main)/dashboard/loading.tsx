function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-800 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#09090b] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-3 space-y-6">

        {/* Header */}
        <div className="space-y-1.5 py-2">
          <Pulse className="h-3.5 w-32" />
          <Pulse className="h-7 w-56" />
        </div>

        {/* Today — 3 cards */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Pulse key={i} className="h-32 rounded-2xl" />
          ))}
        </div>

        {/* Continue Watching + Upcoming Sports — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Pulse className="h-4 w-44" />
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <Pulse key={i} className="flex-1 h-40 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Pulse className="h-4 w-48" />
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <Pulse key={i} className="flex-1 h-40 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          <Pulse className="h-4 w-32" />
          {[1, 2, 3].map((i) => (
            <Pulse key={i} className="h-10 rounded-lg" />
          ))}
        </div>

      </div>
    </div>
  );
}
