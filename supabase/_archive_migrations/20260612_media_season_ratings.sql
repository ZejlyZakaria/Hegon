-- Per-season rating for series/anime — so Top Picks can show the SEASON you
-- watched in a given year with its own rating (e.g. JJK 2026 → "Season 3" rated 9),
-- not the whole-show rating. Only used for shows watched across several years; a
-- single-year show keeps just its title rating.
--
-- Shape: { "<season_number>": <rating 1–10> }  e.g. {"1":8,"2":7,"3":9}
-- Empty {} → fall back to the title's user_rating.

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS season_ratings jsonb NOT NULL DEFAULT '{}'::jsonb;
