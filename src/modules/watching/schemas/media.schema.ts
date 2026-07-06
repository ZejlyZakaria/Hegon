import { z } from "zod";

// =====================================================
// WATCHING SCHEMAS (Zod validation)
// =====================================================

export const updateMediaSchema = z.object({
  id: z.string(),
  user_rating: z.number().min(0).max(10).nullable().optional(),
  current_episode: z.number().optional(),
  current_season: z.number().optional(),
  season_years: z.record(z.string(), z.number()).nullable().optional(),
  season_ratings: z.record(z.string(), z.number()).nullable().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  watched_at: z.string().nullable().optional(),
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

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;