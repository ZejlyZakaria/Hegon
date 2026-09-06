-- watching.episode_highlights
-- Pinned episode highlights per media item (series/anime only)

CREATE TABLE watching.episode_highlights (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_item_id uuid      NOT NULL REFERENCES watching.media_items(id) ON DELETE CASCADE,
  season      int         NOT NULL CHECK (season >= 1),
  episode     int         NOT NULL CHECK (episode >= 1),
  title       text,                    -- cached from TMDB
  still_path  text,                    -- cached from TMDB (relative path)
  note        text,
  created_at  timestamptz DEFAULT now() NOT NULL,

  -- prevent pinning the same episode twice per user
  UNIQUE (user_id, media_item_id, season, episode)
);

CREATE INDEX episode_highlights_media_item_id_idx
  ON watching.episode_highlights (media_item_id);

ALTER TABLE watching.episode_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own episode highlights"
  ON watching.episode_highlights
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
