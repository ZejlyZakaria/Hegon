export default function JournalLoading() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Centre */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 pt-5 pb-4 shrink-0 space-y-1">
          <div className="h-6 w-20 rounded-md bg-zinc-900 animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-zinc-900 animate-pulse" />
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-white/4 px-4 gap-2 shrink-0 pb-1">
          <div className="h-5 w-12 rounded bg-zinc-900 animate-pulse" />
          <div className="h-5 w-20 rounded bg-zinc-900 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 px-4 pt-4 pb-5 space-y-4">
          {/* Mood picker */}
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-16 rounded-md bg-zinc-900 animate-pulse" />
            ))}
          </div>
          {/* Editor */}
          <div className="flex-1 h-64 rounded-lg bg-zinc-900 animate-pulse" />
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 shrink-0 border-l border-white/4 p-4 space-y-3">
        <div className="h-32 rounded-lg bg-zinc-900 animate-pulse" />
        <div className="h-64 rounded-lg bg-zinc-900 animate-pulse" />
        <div className="h-24 rounded-lg bg-zinc-900 animate-pulse" />
      </div>
    </div>
  );
}
