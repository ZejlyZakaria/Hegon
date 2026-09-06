-- Watching Couche 2 — per-episode ratings.
-- Extends episode_highlights into the single "per-episode marks" table: a row can be
-- highlighted (best ep), rated (0-10), or both. `highlighted` defaults FALSE so a
-- rating-only row isn't a best episode; existing rows are all best-ep highlights.

-- rating is numeric to allow half-steps (9.5, 8.5…), matching the season rating.
ALTER TABLE watching.episode_highlights
  ADD COLUMN IF NOT EXISTS rating      numeric(3,1) CHECK (rating >= 0 AND rating <= 10),
  ADD COLUMN IF NOT EXISTS highlighted boolean NOT NULL DEFAULT false;

-- Idempotent safety: if an earlier run created `rating` as int, coerce it to numeric.
ALTER TABLE watching.episode_highlights ALTER COLUMN rating TYPE numeric(3,1);

-- Backfill: every pre-existing row was a best-episode highlight. Guarded so a re-run
-- can't wrongly flip rating-only rows (which always carry a rating).
UPDATE watching.episode_highlights
  SET highlighted = true
  WHERE highlighted = false AND rating IS NULL;
