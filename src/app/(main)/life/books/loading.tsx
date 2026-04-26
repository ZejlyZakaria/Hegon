export default function BooksLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 shrink-0 space-y-1.5">
        <div className="h-6 w-16 rounded-md bg-zinc-900 animate-pulse" />
        <div className="h-3 w-48 rounded-md bg-zinc-900 animate-pulse" />
      </div>

      {/* Stats zone */}
      <div className="px-4 shrink-0 flex items-center gap-6 py-3 border-b border-white/4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-4 w-6 rounded bg-zinc-900 animate-pulse" />
            <div className="h-3 w-16 rounded bg-zinc-900 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-white/4 px-4 gap-1 shrink-0 pb-1 pt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-20 rounded bg-zinc-900 animate-pulse" />
        ))}
      </div>

      {/* Content + right panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 px-4 pt-4 space-y-2 overflow-y-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-900 animate-pulse" />
          ))}
        </div>
        <div className="w-72 shrink-0 border-l border-white/4 p-4 space-y-3">
          <div className="h-28 rounded-lg bg-zinc-900 animate-pulse" />
          <div className="h-40 rounded-lg bg-zinc-900 animate-pulse" />
          <div className="h-32 rounded-lg bg-zinc-900 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
