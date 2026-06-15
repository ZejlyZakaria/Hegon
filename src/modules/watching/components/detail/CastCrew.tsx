"use client";

import Image from "next/image";
import { User } from "lucide-react";
import type { CastMember, CreditedDirector } from "../../hooks/useMediaCredits";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-title text-text-primary">{children}</h2>
  );
}

function PersonCard({ name, src, subtitle, size = 60 }: {
  name: string;
  src: string | null;
  subtitle?: string | null;
  size?: number;
}) {
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="flex shrink-0 flex-col items-center text-center" style={{ width: size }}>
      <div
        className="relative overflow-hidden rounded-full bg-surface-2 ring-2 ring-white/10"
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
      <p className="mt-2 w-full truncate text-[11px] font-medium text-text-secondary">{name}</p>
      {subtitle && <p className="mt-0.5 w-full truncate text-[10px] text-text-tertiary">{subtitle}</p>}
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
        .map((d) => ({ name: d.name, src: d.profile_url, subtitle: "Director" }))
    : [];
  const castSlots = MAX_TOTAL - directorEntries.length;
  const allPeople = [
    ...directorEntries,
    ...cast.slice(0, castSlots).map((p) => ({ name: p.name, src: p.profile_url, subtitle: p.character })),
  ];

  return (
    <section>
      <SectionLabel>Cast & Crew</SectionLabel>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {allPeople.map((person, i) => (
          <PersonCard key={`${person.name}-${i}`} name={person.name} src={person.src} subtitle={person.subtitle} size={86} />
        ))}
      </div>
    </section>
  );
}
