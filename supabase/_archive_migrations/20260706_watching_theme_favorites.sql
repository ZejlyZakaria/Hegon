-- Watching — Theme Favorites ("My Themes")
-- Migration: watching.theme_favorites — the anime OP/ED a user has hearted.
--
-- WHY: favorites were localStorage-only (Zustand persist), so they never synced
-- across devices, were lost on a cache clear, and lived outside the "second brain"
-- (everything else is in Supabase). This table makes them durable + syncable and
-- backs the "My Themes" playlist. The identity is the (anime, label, song) triple,
-- which is stable across sessions (the in-app track id embeds a season index that
-- isn't). audio/video/cover are stored so "My Themes" plays without re-resolving.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE watching.theme_favorites (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  track_key     text        NOT NULL,          -- stable natural key: "animename|label|title" (lowercased)
  anime_name    text        NOT NULL,
  label         text        NOT NULL,          -- "OP1" / "ED2"
  title         text        NOT NULL,
  artist        text        NOT NULL DEFAULT '',
  audio_url     text,
  video_url     text,
  cover         text,                          -- resolved iTunes single art
  media_tmdb_id int,                           -- the media it was hearted from (context, nullable)

  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, track_key)                   -- one favorite per song per org
);

-- ============================================================
-- RLS — org isolation (same pattern as the rest of the app)
-- ============================================================

ALTER TABLE watching.theme_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON watching.theme_favorites
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- Read-only demo guard (RESTRICTIVE = ANDed with org_isolation). SELECT untouched;
-- demo users can't write. Non-demo users evaluate `NOT false = true`, never restricted.
CREATE POLICY "demo_readonly_insert" ON watching.theme_favorites
  AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.is_demo_user());
CREATE POLICY "demo_readonly_update" ON watching.theme_favorites
  AS RESTRICTIVE FOR UPDATE USING (NOT public.is_demo_user());
CREATE POLICY "demo_readonly_delete" ON watching.theme_favorites
  AS RESTRICTIVE FOR DELETE USING (NOT public.is_demo_user());

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX idx_theme_favorites_org ON watching.theme_favorites (org_id, created_at DESC);
