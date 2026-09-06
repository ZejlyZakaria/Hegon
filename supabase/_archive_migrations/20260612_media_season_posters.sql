-- Per-season poster paths (TMDB) for series/anime — powers the visual "Watch
-- History" strip on the detail page (one poster card per season). Aligned with
-- season_episodes (same season_number > 0 filtering / order).
--
-- Shape: array of TMDB poster paths (or null), index = season - 1.
--   e.g. ["/a.jpg", "/b.jpg", null, "/d.jpg"]
-- Empty [] / null entries → fall back to the show poster.

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS season_posters jsonb NOT NULL DEFAULT '[]'::jsonb;
