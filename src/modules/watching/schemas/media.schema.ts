import { z } from "zod";

// =====================================================
// WATCHING SCHEMAS (Zod validation)
// =====================================================

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

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;