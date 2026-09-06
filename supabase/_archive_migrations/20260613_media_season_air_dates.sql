-- Per-season FULL air date (TMDB) for series/anime — replaces season_air_years.
-- Lets the Watch History strip flag a season as "Coming soon" precisely (to the
-- day) when its air_date is in the future or unset, and derive the air year for
-- the "year watched" picker minimum.
--
-- Shape: array of TMDB air_date strings (or null), index = season - 1.
--   e.g. ["2016-04-03", "2017-04-01", null, "2025-06-20"]
-- null / future entries → season treated as not yet released.

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS season_air_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE watching.media_items
  DROP COLUMN IF EXISTS season_air_years;
