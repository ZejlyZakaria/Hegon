-- Watching Couche 2 — Rewatches.
-- WHY: `watched_at` records only the FIRST time you saw something. Rewatching a
-- film/series you love is a real memory signal — one row per re-viewing event,
-- dated and individually removable. The first watch stays on `watched_at`; these
-- are additional events (later they'll feed Hours Watched + a Rewatches stat).

CREATE TABLE watching.rewatches (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_item_id uuid        NOT NULL REFERENCES watching.media_items(id) ON DELETE CASCADE,

  watched_on    date        NOT NULL,   -- the day you rewatched it
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE watching.rewatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON watching.rewatches
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- Read-only demo guard (RESTRICTIVE = ANDed with org_isolation).
CREATE POLICY "demo_readonly_insert" ON watching.rewatches
  AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.is_demo_user());
CREATE POLICY "demo_readonly_update" ON watching.rewatches
  AS RESTRICTIVE FOR UPDATE USING (NOT public.is_demo_user());
CREATE POLICY "demo_readonly_delete" ON watching.rewatches
  AS RESTRICTIVE FOR DELETE USING (NOT public.is_demo_user());

CREATE INDEX idx_rewatches_media ON watching.rewatches (media_item_id, watched_on DESC);
