// Mirrors BookDetailPage on both breakpoints: mobile = title above a compact
// cover+meta hero; desktop = sticky cover column · center cards · quotes column.
export function BookDetailSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Back */}
      <div className="flex shrink-0 items-center px-6 pb-3 pt-4">
        <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[176px_minmax(0,1fr)_340px]">
          {/* Mobile-only title (above the cover) */}
          <div className="flex flex-col gap-2 lg:hidden">
            <div className="h-7 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
          </div>

          {/* Left — cover + meta (hero on mobile, column on desktop) */}
          <div className="flex flex-row gap-4 lg:flex-col lg:gap-3">
            <div className="aspect-2/3 w-28 shrink-0 animate-pulse rounded-lg bg-surface-1 lg:w-full" />
            <div className="flex flex-1 flex-col gap-2 lg:flex-none">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3.5 w-full animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          </div>

          {/* Center — title (desktop) + cards */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="hidden flex-col gap-2 lg:flex">
              <div className="h-7 w-3/4 animate-pulse rounded bg-surface-2" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>

          {/* Right — quotes */}
          <div className="h-48 animate-pulse rounded-lg bg-surface-1" />
        </div>
      </div>
    </div>
  );
}
