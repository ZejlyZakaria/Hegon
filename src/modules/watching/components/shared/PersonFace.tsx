"use client";

import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import { FollowMark } from "@/modules/watching/components/shared/FollowMark";

/**
 * A PERSON AS A FACE — the round portrait, the name, one line under it, and the follow « + » on
 * the rim. THE one face: Cast & Crew on a title, and every rail of Library › People (Following,
 * Your most watched) draw this, so a face is the same object wherever you meet it. The width is
 * the caller's (a paged rail computes it; a grid lets the cell decide).
 */
export function PersonFace({ id, name, src, subtitle, knownFor, style, className }: {
  id: number;
  name: string;
  src: string | null;
  subtitle?: string | null;
  /** TMDB department, stored with a follow so Library › People can say "Actor" / "Director". */
  knownFor?: string | null;
  style?: React.CSSProperties;
  className?: string;
}) {
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const linkable = id > 0;

  const face = (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-full bg-surface-2 ring-2 ring-inset ring-white/10 transition-all",
        linkable && "group-hover:ring-accent-watching-vivid/60",
      )}
    >
      {src ? (
        <Image src={tmdbImageFor(src, 120) || src} alt={name} fill sizes="120px" loading="lazy" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-tertiary">
          {initials || <User size={14} />}
        </div>
      )}
    </div>
  );
  const caption = (
    <>
      <p className={cn("mt-2 w-full truncate text-micro font-medium text-text-secondary", linkable && "transition-colors group-hover:text-text-primary")}>{name}</p>
      {subtitle && <p className="mt-0.5 w-full truncate text-micro text-text-tertiary">{subtitle}</p>}
    </>
  );

  // The « + » sits on the rim (a circle has no corner), OUTSIDE the link so the two doors don't
  // nest: follow the person, or open them.
  return (
    <div className={cn("relative flex shrink-0 snap-start flex-col items-center text-center", className)} style={style}>
      {linkable ? (
        <Link href={`/perso/watching/person/${id}`} className="group flex w-full flex-col items-center">
          {face}
          {caption}
        </Link>
      ) : (
        <div className="flex w-full flex-col items-center">
          {face}
          {caption}
        </div>
      )}
      {linkable && <FollowMark personId={id} name={name} profileUrl={src} knownFor={knownFor} className="absolute right-[6%] top-[2%]" />}
    </div>
  );
}
