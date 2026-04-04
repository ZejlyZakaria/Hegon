import { z } from "zod";

// =====================================================
// WATCHING SCHEMAS (Zod validation)
// =====================================================

export const addMediaSchema = z.object({
  tmdb_id: z.number(),
  type: z.enum(["film", "serie", "anime"]),
  title: z.string().min(1, "Title is required"),
  original_title: z.string(),
  description: z.string().nullable(),
  poster_url: z.string().nullable(),
  backdrop_url: z.string().nullable(),
  year: z.number(),
  runtime: z.number().nullable(),
  episode_runtime: z.number().optional(),
  seasons: z.number().optional(),
  episodes: z.number().optional(),
  rating: z.number(),
  genres: z.array(z.string()),
  directors: z.array(z.object({
    name: z.string(),
    profile_url: z.string().optional(),
  })).optional(),
  studio: z.string().optional(),
  status: z.enum(["ended", "ongoing"]).optional(),
});

export const updateMediaSchema = z.object({
  id: z.string(),
  watch_status: z.enum(["watching", "completed", "plan_to_watch", "dropped"]).optional(),
  user_rating: z.number().min(0).max(10).nullable().optional(),
  current_episode: z.number().optional(),
  current_season: z.number().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  watched_at: z.string().nullable().optional(),
  priority_level: z.enum(["high", "medium", "low"]).optional(),
});

export type AddMediaInput = z.infer<typeof addMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;