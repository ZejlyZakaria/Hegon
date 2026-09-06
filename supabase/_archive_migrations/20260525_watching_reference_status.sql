-- Add is_reference flag to watching.media_items
-- reference = TMDB item added to a list without being in Library / Want-to-Watch
ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS is_reference boolean NOT NULL DEFAULT false;
