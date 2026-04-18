export default function GoalsLoading() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-1 w-12 rounded-full bg-zinc-800 animate-pulse" />
        <div className="h-3 w-16 rounded-full bg-zinc-800 animate-pulse" />
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-zinc-900 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
