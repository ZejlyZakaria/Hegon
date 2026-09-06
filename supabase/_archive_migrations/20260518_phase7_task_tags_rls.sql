-- Phase 7 — task_tags RLS for workspace members
-- Workspace members (not in the org) need access to task_tags via workspace scope,
-- otherwise tag chips never appear on tasks for invited collaborators.

CREATE POLICY "task_tags_workspace_access" ON public.task_tags
  FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE project_id IN (SELECT * FROM public.my_workspace_project_ids())
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE project_id IN (SELECT * FROM public.my_workspace_project_ids())
    )
  );
