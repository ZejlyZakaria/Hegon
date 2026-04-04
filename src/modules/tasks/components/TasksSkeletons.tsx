// =====================================================
// TASKS SKELETON — Simple, generic, no bugs
// =====================================================

export function TasksSkeleton() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-3">
      {[80, 60, 72, 50, 65].map((w, i) => (
        <div key={i} className="h-10 rounded-lg bg-zinc-800/60" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
