-- Per-season watch year for series/anime — so Hours Watched can attribute each
-- season to the year you actually watched it (e.g. JJK S1=2021, S2=2023, S3=2026),
-- instead of dumping the whole show on a single date.
--
-- Shape: { "<season_number>": <year> }  e.g. {"1":2021,"2":2023,"3":2026}
-- Films don't use it. Empty {} → fall back to watched_at/updated_at (legacy behaviour).

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS season_years jsonb NOT NULL DEFAULT '{}'::jsonb;
