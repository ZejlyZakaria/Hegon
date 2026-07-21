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
  // Anime v2 — per-cour year/rating for AniList-overlaid anime.
  cour_years: z.record(z.string(), z.number()).nullable().optional(),
  cour_ratings: z.record(z.string(), z.number()).nullable().optional(),
  favorite: z.boolean().optional(),
  /** Top-10 rank. A ranking, not a status — see `claimedStatus`: loving it is not having seen it. */
  priority: z.number().nullable().optional(),
  /** TMDB's own score, refreshed when a door re-reads the title. Yours is `user_rating`. */
  rating: z.number().nullable().optional(),
  // The world's facts about the seasons. The sync job owns them; a door that has just re-read TMDB
  // may refresh them too. They were NOT declared here, so `parse()` — a stripping parse — silently
  // deleted them from any patch that carried them. Declared, therefore preserved.
  season_aired: z.array(z.number()).nullable().optional(),
  season_episodes: z.array(z.number()).nullable().optional(),
  season_posters: z.array(z.string().nullable()).optional(),
  season_air_dates: z.array(z.string().nullable()).optional(),
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
/**
 * A FILM HAS NO COURS — so it may not carry cour-indexed maps.
 *
 * `cour_years` / `cour_ratings` exist for one reason: a lumped anime whose seasons AniList splits
 * into cours, where `season_years` (indexed by TMDB season) cannot express "season 2 of three that
 * TMDB calls one". A film has exactly one of everything. Writing those columns on one is not a
 * smaller truth, it is a category error — and the row would then be read through a lens that has
 * nothing to translate.
 *
 * Nothing stopped it. The columns are plain jsonb, every door could write them, and the mistake
 * would have surfaced months later as a film with a mysterious year map that no screen displays.
 * Refused here, and again by a CHECK constraint in the database (20260721_cour_columns_series_only)
 * so a write that never passes through this schema still cannot land it.
 */
function refuseCoursOnFilm(
  v: { type?: string | null; cour_years?: unknown; cour_ratings?: unknown },
  ctx: z.RefinementCtx,
) {
  if (v.type !== "film") return;
  for (const key of ["cour_years", "cour_ratings"] as const) {
    const value = v[key];
    // `null` and `{}` are fine — they say "nothing here", which is true of a film.
    const carriesData = value != null && Object.keys(value as object).length > 0;
    if (carriesData) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is cour-indexed and only means something for a lumped anime. A film has no cours.`,
      });
    }
  }
}

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
  refuseCoursOnFilm(v, ctx);
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

/**
 * THE INSERT BARRIER — the same medicine, on the door the update barrier never covered.
 *
 * `insertMediaItem(data: Record<string, any>)` accepted anything, so every rule the update path
 * enforces stopped at the threshold. That is how the LIMBO ROW was born: a series added through the
 * "In Progress" door arrived with `watched:false, in_progress:false, want_to_watch:false` — no
 * status at all. It is in your library and in none of its rails; its detail page reads "Want to
 * Watch" because that is what `deriveWatchStatus` returns when nothing is true. Nobody wrote that
 * row on purpose. Nothing refused it either.
 *
 * Three invariants, and they are the SAME three the rest of the module already lives by:
 *
 *  1. EXACTLY ONE STATUS. Not "at most" — a row with none is the limbo row, and a row with two is
 *     the drift `deriveWatchStatus` was written to arbitrate. `is_reference` counts as a status: a
 *     bare stub added to a custom list is legitimately in no rail, and that is a STATEMENT.
 *  2. A POSITION CARRIES ITS `caught_up_at` — identical to the update rule, for the identical
 *     reason: the stamp is a FUNCTION of where you stand, so it cannot be optional at any door.
 *  3. A SERIES YOU ARE WATCHING (or paused/dropped/finished) HAS A POSITION. The claim and its
 *     evidence travel together: `watchedCount()` reads a null position as zero episodes seen, so a
 *     positionless `watched` series prints "0 / 62 episodes" under the word "Watched". `want_to_watch`
 *     and `is_reference` are exempt — they claim no viewing, so they have nothing to evidence.
 *
 * A door that forgets any of this now FAILS, loudly, at the door — including doors not yet written.
 * Build the patch with `addStatusPatch()` (lib/watch-status.ts) and all three hold for free.
 */
const insertMediaFields = z.looseObject({
  user_id: z.string(),
  type: z.enum(["film", "serie", "anime"]),
  tmdb_id: z.number(),
  watched: z.boolean(),
  in_progress: z.boolean(),
  want_to_watch: z.boolean(),
  paused: z.boolean().optional(),
  dropped: z.boolean().optional(),
  is_reference: z.boolean().optional(),
  current_season: z.number().nullable().optional(),
  current_episode: z.number().nullable().optional(),
  caught_up_at: z.string().nullable().optional(),
  watched_at: z.string().nullable().optional(),
});

export const insertMediaSchema = insertMediaFields.superRefine((v, ctx) => {
  const statuses = ["watched", "in_progress", "want_to_watch", "paused", "dropped", "is_reference"] as const;
  const live = statuses.filter((k) => v[k] === true);
  if (live.length !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["watched"],
      message:
        live.length === 0
          ? "This row has no status: it would be in your library and in none of its rails, and its detail page would read \"Want to Watch\". Derive the status with addStatusPatch() (lib/watch-status.ts) — for a series it comes from the position, never from the list you came through."
          : `A row cannot be ${live.join(" and ")} at once. Build the patch with addStatusPatch() (lib/watch-status.ts); it clears what it does not set.`,
    });
  }

  const hasPosition = v.current_season != null || v.current_episode != null;
  if (hasPosition && !("caught_up_at" in v)) {
    ctx.addIssue({
      code: "custom",
      path: ["caught_up_at"],
      message:
        "A position write must state caught_up_at. Build the patch with addStatusPatch() (lib/watch-status.ts) instead of writing current_season/current_episode by hand.",
    });
  }

  const claimsViewing = v.watched === true || v.in_progress === true || v.paused === true || v.dropped === true;
  if (v.type !== "film" && claimsViewing && v.current_episode == null) {
    ctx.addIssue({
      code: "custom",
      path: ["current_episode"],
      message:
        "A series you have started must say how far you got — a positionless claim reads as zero episodes watched everywhere it is counted. Collect a position and pass it to addStatusPatch().",
    });
  }

  refuseCoursOnFilm(v, ctx);
});

export type InsertMediaInput = z.infer<typeof insertMediaSchema>;

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