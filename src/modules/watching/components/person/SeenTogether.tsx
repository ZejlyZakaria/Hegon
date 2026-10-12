"use client";

import { collaborators } from "../../lib/person-experience";

import Link from "next/link";
import Image from "next/image";
import { tmdbImageFor } from "../../lib/tmdb-image";
import { SectionHeader } from "@/shared/components/ui/section-header";
import type { PersonTitle } from "../../service";

interface Props {
  titles: PersonTitle[];   // your titles with this person (roles attached)
  personId: number;        // exclude them from their own co-star list
  firstName: string;
}

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// The faces you've seen ALONGSIDE this person, mined from your own library (not TMDB).
// Every one is a link → the person web is navigable: each page opens three more.
export function SeenTogether({ titles, personId, firstName }: Props) {
  const people = collaborators(titles, personId).slice(0, 8);

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
                  <Image src={tmdbImageFor(p.profile_url, 36) || p.profile_url} alt={p.name} fill loading="lazy" sizes="36px" className="object-cover" />
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
                  {p.count > 1 ? `${p.count} titles` : p.roleLabel}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
