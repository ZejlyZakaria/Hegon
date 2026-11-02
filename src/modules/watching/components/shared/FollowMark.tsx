"use client";

import { Check, UserRoundPlus } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Hint } from "@/shared/components/ui/tooltip";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFollowActions, useFollowedIds } from "@/modules/watching/hooks/useFollows";

/**
 * THE « + » ON A FACE — follow this person (owner, 2026-09-16, §11).
 *
 * A circle has no corner, so the mark sits ON THE RIM at the top-right, the way a presence dot
 * sits on an avatar. Idle: a person-plus on the dark artwork disc. Followed:
 * the SAME disc, the glyph becomes a teal check — a filled teal disc read too big next to a face
 * (owner). Readable without hovering, which is the point of a state. One tap toggles; optimistic,
 * so it answers on the click.
 *
 * Always visible: on a face there is no hover reveal — the face is small, and a state you can only
 * see by hovering is not a state. A `span` with a button role: it sits beside links, not inside.
 */
export function FollowMark({ personId, name, profileUrl, knownFor, size = "sm", className }: {
  personId: number;
  name: string;
  profileUrl?: string | null;
  knownFor?: string | null;
  /** Visible circle:24px on a rail face,28px on the person portrait; touch target stays44px. */
  size?: "sm" | "md";
  className?: string;
}) {
  const userId = useCurrentUserId();
  const idsQ = useFollowedIds(userId);
  const actions = useFollowActions(userId);
  const followed = !!idsQ.data?.includes(personId);
  if (!userId) return null;

  const toggle = () => actions.mutate({
    person: { person_tmdb_id: personId, name, profile_url: profileUrl ?? null, known_for: knownFor ?? null },
    undo: followed,
  });
  const px = size === "md" ? 28 : 24;
  const glyph = size === "md" ? 14 : 13;

  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{width:px,height:px}}>
    <Hint label={followed ? "Following" : "Follow"}>
      <span
        data-kind="follow"
        data-size={size}
        data-state={followed ? "done" : "idle"}
        role="button"
        tabIndex={0}
        aria-pressed={followed}
        aria-label={followed ? `Unfollow ${name}` : `Follow ${name}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggle(); } }}
        className={cn("watching-artwork-action absolute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-watching-vivid can-hover:left-0 can-hover:top-0", size === "md" ? "-left-2 -top-2" : "-left-2.5 -top-2.5")}
      >
        {followed ? <Check size={glyph} strokeWidth={3} /> : <UserRoundPlus size={glyph} strokeWidth={2} />}
      </span>
    </Hint>
    </span>
  );
}
