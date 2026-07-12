"use client";

import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";
import { SectionHeader } from "@/shared/components/ui/section-header";
import type { CastMember, CreditedDirector } from "../../hooks/useMediaCredits";

function PersonCard({ id, name, src, subtitle, size = 60 }: {
  id: number;
  name: string;
  src: string | null;
  subtitle?: string | null;
  size?: number;
}) {
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const linkable = id > 0;

  const inner = (
    <>
      <div
        className={`relative overflow-hidden rounded-full bg-surface-2 ring-2 ring-inset ring-white/10 transition-all ${linkable ? "group-hover:ring-accent-watching-vivid/60" : ""}`}
        style={{ width: size, height: size }}
      >
        {src ? (
          <Image src={src} alt={name} fill sizes={`${size}px`} unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-tertiary">
            {initials || <User size={14} />}
          </div>
        )}
      </div>
      <p className={`mt-2 w-full truncate text-micro font-medium text-text-secondary ${linkable ? "transition-colors group-hover:text-text-primary" : ""}`}>{name}</p>
      {subtitle && <p className="mt-0.5 w-full truncate text-micro text-text-tertiary">{subtitle}</p>}
    </>
  );

  if (linkable) {
    return (
      <Link href={`/perso/watching/person/${id}`} className="group flex shrink-0 flex-col items-center text-center" style={{ width: size }}>
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-center text-center" style={{ width: size }}>
      {inner}
    </div>
  );
}

interface Props {
  cast: CastMember[];
  directors: CreditedDirector[];
  isSeries: boolean;
}

export function CastCrew({ cast, directors, isSeries }: Props) {
  if (cast.length === 0 && (isSeries || directors.length === 0)) return null;

  const MAX_TOTAL = 9;
  const directorEntries = !isSeries
    ? directors
        .filter((d, i, arr) => arr.findIndex((x) => x.name === d.name) === i)
        .map((d) => ({ id: d.id, name: d.name, src: d.profile_url, subtitle: "Director" }))
    : [];
  const castSlots = MAX_TOTAL - directorEntries.length;
  const allPeople = [
    ...directorEntries,
    ...cast.slice(0, castSlots).map((p) => ({ id: p.id, name: p.name, src: p.profile_url, subtitle: p.character })),
  ];

  // No panel: this is a rail that scrolls. A frame whose content escapes through its own
  // edge reads as a layout bug, not as "there's more to the right". Panels are for bounded
  // content you act on (My Take, the rail); scrolling rails breathe on the page.
  return (
    <section>
      <SectionHeader title="Cast & Crew" />
      {/* Same bleed as every other rail: break out of the column gutter so a face can scroll
          under the screen edge, and start at the same x as its neighbours. py-1 is the hover
          scale's headroom — an overflow-x container clips vertically too. */}
      <div
        className="-mx-4 flex gap-4 overflow-x-auto scroll-px-4 px-4 py-1 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "none" }}
      >
        {allPeople.map((person, i) => (
          <PersonCard key={`${person.name}-${i}`} id={person.id} name={person.name} src={person.src} subtitle={person.subtitle} size={86} />
        ))}
      </div>
    </section>
  );
}
