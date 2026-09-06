-- Phase 7 — Tags per workspace
-- Move tags from user-scoped to workspace-scoped so they can be shared by
-- all members of a workspace (Linear/Asana model).

-- ── Step 1: add workspace_id column ──────────────────────────────────────────

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ── Step 2: migrate existing tags to the owner's first workspace ─────────────
-- For each tag, link it to its user's lowest-position workspace.
-- For Zakaria: Hegon (position 1) → all his existing tags go there.

UPDATE public.tags t
SET workspace_id = (
  SELECT w.id
  FROM public.workspaces w
  WHERE w.user_id = t.user_id
  ORDER BY w.position ASC NULLS LAST, w.created_at ASC
  LIMIT 1
)
WHERE workspace_id IS NULL;

-- ── Step 3: clean up orphan tags (owner had no workspace) ────────────────────

DELETE FROM public.tags WHERE workspace_id IS NULL;

-- ── Step 4: enforce NOT NULL ─────────────────────────────────────────────────

ALTER TABLE public.tags ALTER COLUMN workspace_id SET NOT NULL;

-- ── Step 5: index for query perf ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tags_workspace_id_idx ON public.tags(workspace_id);

-- ── Step 6: trigger to auto-derive org_id from workspace ─────────────────────
-- Mirrors phase6 fix03 pattern for projects/statuses/tasks.

CREATE OR REPLACE FUNCTION public.set_tag_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tags_set_org_id ON public.tags;
CREATE TRIGGER tags_set_org_id
  BEFORE INSERT ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tag_org_id();

-- ── Step 7: replace RLS policies (workspace-scoped) ──────────────────────────

DROP POLICY IF EXISTS "workspace_member_read" ON public.tags;

CREATE POLICY "tags_workspace_access" ON public.tags
  FOR ALL
  USING (
    workspace_id IN (SELECT * FROM public.my_workspace_ids())
    OR workspace_id IN (SELECT * FROM public.my_org_workspace_ids())
  )
  WITH CHECK (
    workspace_id IN (SELECT * FROM public.my_workspace_ids())
    OR workspace_id IN (SELECT * FROM public.my_org_workspace_ids())
  );

-- ── Step 8: REPLICA IDENTITY FULL for realtime DELETE events ─────────────────

ALTER TABLE public.tags REPLICA IDENTITY FULL;
