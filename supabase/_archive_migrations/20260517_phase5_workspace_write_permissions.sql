-- Phase 5 — Write permissions for workspace members
-- Fix: use SECURITY DEFINER functions to avoid RLS circular dependency
-- Replaces direct workspace_members subqueries in projects/statuses/tasks policies

-- ── New SECURITY DEFINER helper ───────────────────────────────────────────────

-- Returns project ids belonging to workspaces the user is a member of
-- Bypasses RLS on both workspace_members and projects → no circular dependency
CREATE OR REPLACE FUNCTION public.my_workspace_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id
  FROM public.projects p
  INNER JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
  WHERE wm.user_id = auth.uid();
$$;

-- ── Drop old policies (used direct subqueries, possible RLS issues) ───────────

DROP POLICY IF EXISTS "workspace_member_access" ON public.projects;
DROP POLICY IF EXISTS "workspace_member_access" ON public.statuses;
DROP POLICY IF EXISTS "workspace_member_access" ON public.tasks;

-- ── Recreate with SECURITY DEFINER functions ──────────────────────────────────

-- projects: full access for workspace members
CREATE POLICY "workspace_member_write" ON public.projects
  FOR ALL
  USING (workspace_id IN (SELECT * FROM public.my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT * FROM public.my_workspace_ids()));

-- statuses: full access for workspace members
CREATE POLICY "workspace_member_write" ON public.statuses
  FOR ALL
  USING (project_id IN (SELECT * FROM public.my_workspace_project_ids()))
  WITH CHECK (project_id IN (SELECT * FROM public.my_workspace_project_ids()));

-- tasks: full access for workspace members
CREATE POLICY "workspace_member_write" ON public.tasks
  FOR ALL
  USING (project_id IN (SELECT * FROM public.my_workspace_project_ids()))
  WITH CHECK (project_id IN (SELECT * FROM public.my_workspace_project_ids()));
