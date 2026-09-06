-- Cast members cached from TMDB at add time (and backfilled), so the detail
-- page's Cast & Crew renders straight from the DB instead of an extra TMDB call
-- on every open. Crew (directors) + studio are already stored. Note: "cast" is a
-- reserved SQL keyword, so the column is cast_members.
--
-- Shape: [{ id, name, character, profile_url }]  (top ~12, ready to render)

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS cast_members jsonb NOT NULL DEFAULT '[]'::jsonb;
