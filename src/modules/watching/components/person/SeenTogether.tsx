"use client";

import Link from "next/link";
import Image from "next/image";
import { SectionHeader } from "@/shared/components/ui/section-header";
import type { PersonTitle } from "../../service";

interface Props {
  titles: PersonTitle[];   // your titles with this person (roles attached)
  personId: number;        // exclude them from their own co-star list
  firstName: string;
}

interface CoPerson {
  id: number;
  name: string;
  profile_url: string | null;
  count: number;
  billing: number;         // best (lowest) cast position — tie-breaker
  isDirector: boolean;
}

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// The faces you've seen ALONGSIDE this person, mined from your own library (not TMDB).
// Every one is a link → the person web is navigable: each page opens three more.
export function SeenTogether({ titles, personId, firstName }: Props) {
  // "Together" means you actually watched it — a want-to-watch isn't shared history.
  const seen = titles.filter((t) => !(t.want_to_watch && !t.watched && !t.in_progress && !t.paused && !t.dropped));

  const map = new Map<number, CoPerson>();
  const add = (p: { id?: number; name: string; profile_url?: string | null }, billing: number, isDirector: boolean) => {
    if (!p?.id || p.id === personId) return;
    const prev = map.get(p.id);
    if (prev) {
      prev.count += 1;
      prev.billing = Math.min(prev.billing, billing);
      prev.profile_url ??= p.profile_url ?? null;
    } else {
      map.set(p.id, { id: p.id, name: p.name, profile_url: p.profile_url ?? null, count: 1, billing, isDirector });
    }
  };
  for (const t of seen) {
    t.cast_members.forEach((c, i) => add(c, i, false));
    t.directors.forEach((d) => add(d, 0, true));
  }

  // Shared titles first; then faces before directors (a rail of directors is what you get
  // otherwise — everyone ties at 1); then top billing, which is who you actually remember.
  const people = [...map.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(a.isDirector) - Number(b.isDirector) ||
        a.billing - b.billing ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 8);

  if (people.length === 0) return null;

  return (
    <section>
      <SectionHeader title={`Seen with ${firstName}`} />
      <div className="surface-quiet rounded-card p-2">
        <div className="grid grid-cols-2 gap-1">
          {people.map((p) => (
            <Link
              key={p.id}
              href={`/perso/watching/person/${p.id}`}
              className="group flex min-w-0 items-center gap-2.5 rounded-control p-2 transition-colors hover:bg-surface-2"
            >
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border-subtle transition-all group-hover:ring-2 group-hover:ring-accent-watching-vivid/60">
                {p.profile_url ? (
                  <Image src={p.profile_url} alt={p.name} fill unoptimized loading="lazy" sizes="36px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-micro font-semibold text-text-tertiary">
                    {initials(p.name)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">
                  {p.name}
                </p>
                <p className="truncate text-micro text-text-tertiary">
                  {p.count > 1 ? `${p.count} titles` : p.isDirector ? "Director" : "Actor"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
