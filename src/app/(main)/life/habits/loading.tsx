export default function HabitsLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* topbar */}
      <div className="h-14 border-b border-white/5 bg-zinc-950/50 flex items-center px-4 gap-4 shrink-0">
        <div className="h-9 flex-1 max-w-xs rounded-lg bg-zinc-900 animate-pulse" />
        <div className="ml-auto h-9 w-28 rounded-lg bg-zinc-900 animate-pulse" />
      </div>

      <div className="flex-1 px-4 py-5 space-y-5">
        {/* module header */}
        <div className="space-y-2">
          <div className="h-6 w-24 rounded-md bg-zinc-900 animate-pulse" />
          <div className="h-4 w-48 rounded-md bg-zinc-900 animate-pulse" />
          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 w-20 rounded-full bg-zinc-900 animate-pulse" />
            ))}
          </div>
        </div>

        {/* progress bar */}
        <div className="h-12 rounded-xl bg-zinc-900 animate-pulse" />

        {/* tabs */}
        <div className="h-10 w-64 rounded-lg bg-zinc-900 animate-pulse" />

        {/* habit rows */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
