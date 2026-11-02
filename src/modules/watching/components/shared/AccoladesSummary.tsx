import type { ReactNode } from "react";
import { ChevronRight, Trophy } from "lucide-react";

/** Shared presentation; each surface supplies only its own verified award scope. */
export function AccoladesSummary({ counters, featured, tracked, interactive, children }: {
  counters: readonly { value: number; label: string; won: boolean }[];
  featured: { label: string; count: number; years: string } | null;
  tracked: boolean;
  interactive: boolean;
  children?: ReactNode;
}) {
  return <>
    <div className="flex items-center justify-between gap-3">
      <span role="heading" aria-level={2} className="text-title text-text-primary">Accolades</span>
      {interactive && <ChevronRight size={14} className="shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary" />}
    </div>
    <dl className={`mt-4 grid gap-4 ${counters.length > 2 ? "grid-cols-3" : counters.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {counters.map(c => <div key={c.label} className="min-w-0">
        <dd className="text-3xl font-semibold leading-none tracking-tight tabular-nums" style={c.won ? { color: "var(--color-award)" } : undefined}>{c.value}</dd>
        <dt className="mt-2 text-xs leading-snug text-text-secondary">{c.label}</dt>
      </div>)}
    </dl>
    {tracked && <p className="mt-2 text-micro text-text-tertiary">In tracked categories</p>}
    {featured && <div className="mt-4 flex items-start gap-3 border-t border-border-subtle pt-4">
      <Trophy size={17} className="mt-0.5 shrink-0" style={{ color: "var(--color-award)" }} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-text-primary">{featured.label}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{featured.count} {featured.count === 1 ? "win" : "wins"} {"\u00b7"} {featured.years}</p>
      </div>
    </div>}
    {children}
  </>;
}
