import { z } from "zod";

// =====================================================
// WATCHING SCHEMAS (Zod validation)
// =====================================================

const updateMediaFields = z.object({
  id: z.string(),
  /**
   * ROUTING METADATA — never written to the database, and stripped before the update.
   *
   * A status change invalidated the carousels of ALL THREE types, because the mutation knew an id
   * and nothing else: pausing an anime went and refetched the film rails. Telling it what you
   * touched costs the caller nothing (every caller has the row in hand) and cuts the refetch storm
   * to the third of it that can actually have changed.
   */
  type: z.enum(["film", "serie", "anime"]).optional(),
  user_rating: z.number().min(0).max(10).nullable().optional(),
  current_episode: z.number().optional(),
  current_season: z.number().optional(),
  season_years: z.record(z.string(), z.number()).nullable().optional(),
  season_ratings: z.record(z.string(), z.number()).nullable().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  watched_at: z.string().nullable().optional(),
  /** Stamped on FORWARD progress only. A correction is not a viewing. */
  last_watched_at: z.string().nullable().optional(),
  caught_up_at: z.string().nullable().optional(),
  priority_level: z.enum(["high", "medium", "low"]).optional(),
  watched: z.boolean().optional(),
  in_progress: z.boolean().optional(),
  want_to_watch: z.boolean().optional(),
  is_reference: z.boolean().optional(),
  recently_watched: z.boolean().optional(),
  dropped: z.boolean().optional(),
  drop_reason: z.string().nullable().optional(),
  paused: z.boolean().optional(),
});

/**
 * THE INVARIANT, ENFORCED IN THE PIPE — not in anyone's memory.
 *
 * `caught_up_at` records that you stood at the frontier of what has aired. It is what lets a title
 * light up as "New episodes" later instead of merely "behind", and it is a FUNCTION of where you
 * stand — so every write of a position must recompute it.
 *
 * That rule was written as a comment, and then broken twenty lines below it, in the Undo of the
 * very button whose comment stated it: the Undo put the position back and left the stamp behind,
 * so a show you had never caught up to would announce new episodes the next time one aired.
 *
 * A rule that depends on the next person remembering it is not a rule. So the schema refuses the
 * write. `lib/watch-status.ts#positionPatch` is the way through: it computes the stamp for you.
 * (`null` is a perfectly good answer — it means "you are not at the frontier". What is forbidden
 * is not ANSWERING.)
 */
export const updateMediaSchema = updateMediaFields.superRefine((v, ctx) => {
  const movesPosition = "current_season" in v || "current_episode" in v;
  if (movesPosition && !("caught_up_at" in v)) {
    ctx.addIssue({
      code: "custom",
      path: ["caught_up_at"],
      message:
        "A position write must recompute caught_up_at. Build the patch with positionPatch() (lib/watch-status.ts) instead of writing current_season/current_episode by hand.",
    });
  }
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

/**
 * The COLUMNS to write. Two of the input's keys are not columns and must never reach the database:
 * `id` addresses the row, and `type` only tells the mutation which carousels to invalidate.
 */
export function toColumns(input: UpdateMediaInput): Record<string, unknown> {
  const columns: Record<string, unknown> = { ...input };
  delete columns.id;
  delete columns.type;
  return columns;
}