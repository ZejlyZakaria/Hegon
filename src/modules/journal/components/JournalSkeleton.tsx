function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 animate-pulse ${className ?? ""}`} />;
}

export function JournalTodayViewSkeleton() {
  return (
    <div className="flex flex-col h-full gap-6">
      {/* Mood picker */}
      <div>
        <SkeletonBlock className="h-9 w-64 rounded-lg" />
      </div>

      {/* Editor — bg-surface-1 card with textarea area + bottom bar */}
      <div className="flex-1 min-h-0 bg-surface-1 rounded-lg flex flex-col">
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
          className="h-24 bg-surface-1 rounded-lg border border-border-subtle animate-pulse"
        />
      ))}
    </div>
  );
}

function JournalRightPanelSkeleton() {
  return (
    <div className="w-full flex flex-col gap-3">
      {/* Streak */}
      <div className="bg-surface-1 rounded-lg p-4 space-y-3">
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
      <div className="bg-surface-1 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-6 w-12 rounded-md" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-6" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 rounded-md" />
          ))}
        </div>
      </div>

      {/* Mood legend */}
      <div className="bg-surface-1 rounded-lg p-4 space-y-2">
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
    <div className="flex h-full overflow-hidden gap-6 pr-6">
      {/* Left column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-5 w-16" />
            <SkeletonBlock className="h-3.5 w-64" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-6 shrink-0">
          <SkeletonBlock className="h-3.5 w-12 mx-3" />
          <SkeletonBlock className="h-3.5 w-20 mx-3" />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden pl-6 pt-4 pb-5">
          <JournalTodayViewSkeleton />
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 shrink-0 overflow-y-auto pt-4 pb-5">
        <JournalRightPanelSkeleton />
      </div>
    </div>
  );
}
