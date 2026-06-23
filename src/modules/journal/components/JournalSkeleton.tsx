function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 animate-pulse ${className ?? ""}`} />;
}

export function JournalTodayViewSkeleton() {
  return (
    <div className="flex flex-col h-full gap-5">
      {/* Mood orbs */}
      <div className="flex items-center gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-2 w-8" />
          </div>
        ))}
      </div>

      {/* Editor — bg-surface-1 card with textarea area + bottom bar */}
      <div className="flex-1 min-h-0 surface-card rounded-card flex flex-col">
        <div className="flex-1 px-8 py-6 space-y-3">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-4 w-1/3" />
        </div>
        <div className="flex items-center justify-between px-8 py-4 border-t border-border-subtle">
          <SkeletonBlock className="h-6 w-32 rounded" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
      </div>

      {/* Today's context */}
      <div className="pb-2 space-y-2">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-48" />
      </div>
    </div>
  );
}

export function JournalEntryListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-24 surface-card rounded-card animate-pulse"
        />
      ))}
    </div>
  );
}

function JournalRightPanelSkeleton() {
  return (
    <div className="w-full flex flex-col gap-3">
      {/* Streak */}
      <div className="surface-card rounded-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-12" />
        </div>
        <SkeletonBlock className="h-8 w-16" />
        <div className="flex items-center justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-2.5 w-4" />
              <SkeletonBlock className="h-2 w-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="surface-card rounded-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-6 w-12 rounded-control" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-6" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 rounded-control" />
          ))}
        </div>
      </div>

      {/* Mood legend */}
      <div className="surface-card rounded-card p-4 space-y-2">
        <SkeletonBlock className="h-3 w-10 mb-1" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonBlock className="h-2 w-2 rounded-full shrink-0" />
              <SkeletonBlock className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function JournalLoadingSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Full-width tab rail — flush under the TopBar (matches the real page). */}
      <div className="flex items-center border-b border-border-subtle px-4 py-2 shrink-0 sm:px-6">
        <SkeletonBlock className="h-3.5 w-12 mx-3" />
        <SkeletonBlock className="h-3.5 w-20 mx-3" />
      </div>

      {/* Content row */}
      <div className="flex flex-1 min-h-0 overflow-hidden gap-6 pr-6">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden pl-6 pt-4 pb-5">
            <JournalTodayViewSkeleton />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 overflow-y-auto pt-4 pb-5">
          <JournalRightPanelSkeleton />
        </div>
      </div>
    </div>
  );
}
