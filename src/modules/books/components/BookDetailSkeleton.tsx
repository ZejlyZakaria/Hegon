export function BookDetailSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-4 pb-3 shrink-0 flex items-center">
        <div className="h-4 w-16 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex gap-6 max-w-4xl">
          <div className="w-44 shrink-0">
            <div className="w-full aspect-2/3 bg-surface-1 rounded-lg border border-border-subtle animate-pulse" />
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="h-7 w-3/4 bg-surface-2 rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-surface-2 rounded animate-pulse" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 bg-surface-1 rounded-lg border border-border-subtle animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
