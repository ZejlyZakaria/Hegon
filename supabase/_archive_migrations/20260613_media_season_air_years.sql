-- Per-season air year (TMDB) for series/anime — so the "year watched" picker for
-- a season can't offer years before that season aired (you can't have watched
-- S8 in 2023 if it only aired in 2025). Aligned with season_episodes (same
-- season_number > 0 filtering / order).
--
-- Shape: array of years (or null), index = season - 1.  e.g. [2016, 2017, null, 2025]
-- null entries → fall back to the show's release year as the minimum.

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS season_air_years jsonb NOT NULL DEFAULT '[]'::jsonb;
