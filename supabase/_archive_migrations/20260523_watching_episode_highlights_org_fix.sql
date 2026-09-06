-- ── Add org_id to episode_highlights + align policy with org_isolation pattern ──

ALTER TABLE watching.episode_highlights
  ADD COLUMN org_id uuid;

-- Backfill org_id from the parent media_item (every highlight has a media_item_id)
UPDATE watching.episode_highlights eh
SET org_id = mi.org_id
FROM watching.media_items mi
WHERE eh.media_item_id = mi.id;

-- Now enforce NOT NULL
ALTER TABLE watching.episode_highlights
  ALTER COLUMN org_id SET NOT NULL;

-- Drop old user_id-based policy
DROP POLICY IF EXISTS "Users manage their own episode highlights" ON watching.episode_highlights;

-- Replace with org_isolation (same pattern as media_items)
CREATE POLICY "org_isolation" ON watching.episode_highlights
  FOR ALL TO public
  USING (
    org_id IN (SELECT my_orgs.my_orgs FROM my_orgs() my_orgs(my_orgs))
  )
  WITH CHECK (
    org_id IN (SELECT my_orgs.my_orgs FROM my_orgs() my_orgs(my_orgs))
  );
