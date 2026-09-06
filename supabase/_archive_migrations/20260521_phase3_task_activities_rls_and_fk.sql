-- task_activities: FK → profiles + RLS policy for workspace collaborators
-- Applied 2026-05-21 during Activity Log V2 (Tasks V2)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FK: task_activities.user_id → profiles.id
--    Required for PostgREST join syntax: .select("*, user:profiles(...)")
--    ON DELETE SET NULL so deleting a profile doesn't cascade-delete their activities
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.task_activities
  ADD CONSTRAINT task_activities_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS policy: workspace collaborators can read activities
--    The existing org_isolation policy only covered org members (via my_orgs()).
--    Workspace collaborators (workspace_members table) were excluded.
--    This policy grants SELECT to anyone whose workspace_member access covers
--    the task's project.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY workspace_member_access ON public.task_activities
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE project_id IN (SELECT * FROM my_workspace_project_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. One-time data fix: correct org_id on existing rows
--    logActivity() was using the logged-in user's own org_id instead of the
--    task's org_id. This caused the workspace owner to be unable to see
--    activities logged by collaborators (org_isolation policy filtered them out).
--    Fix: align org_id with the task's org_id for all mismatched rows.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.task_activities
SET org_id = (
  SELECT t.org_id FROM public.tasks t WHERE t.id = task_activities.task_id
)
WHERE org_id != (
  SELECT t.org_id FROM public.tasks t WHERE t.id = task_activities.task_id
);
