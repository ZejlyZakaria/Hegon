-- Watching — Theme Favorites: store the anime's own artwork alongside the track.
-- WHY: the iTunes single cover is often just the singer's face. "My Themes" (a
-- cross-anime collection) reads better with each theme shown as its ANIME's poster
-- (which we already have from TMDB). We keep `cover` (iTunes) for the detail panel
-- and use this for the My Themes rail/view — the "hybrid" artwork model.

ALTER TABLE watching.theme_favorites
  ADD COLUMN IF NOT EXISTS anime_poster text;
