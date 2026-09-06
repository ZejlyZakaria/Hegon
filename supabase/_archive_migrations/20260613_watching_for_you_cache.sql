-- For You recommendations cache — one row per (user, type) holding the ranked
-- list precomputed by the `for-you-refresh` edge function (cron, every 5 days).
-- The app READS this table (instant); only the edge function (service role)
-- writes it. We store ~20 so the carousel (which shows 10) keeps a deep reserve
-- and never empties as you add / dismiss titles between refreshes.
--
-- items shape (jsonb array):
--   [{ id, title, poster_path, backdrop_path, vote_average, year, overview,
--      genre_ids, is_new }]

CREATE TABLE IF NOT EXISTS watching.for_you_cache (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('film','serie','anime')),
  items       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type)
);

ALTER TABLE watching.for_you_cache ENABLE ROW LEVEL SECURITY;

-- Users may only READ their own cache. Writes happen exclusively via the edge
-- function using the service role (which bypasses RLS), so there is deliberately
-- no INSERT/UPDATE policy for end users — they can't tamper with their recs.
CREATE POLICY "Users read their own for-you cache"
  ON watching.for_you_cache
  FOR SELECT
  USING (auth.uid() = user_id);
