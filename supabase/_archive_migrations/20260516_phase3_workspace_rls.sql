-- Phase 3 — Workspace Sharing
-- Migration : nouvelles RLS policies pour workspace members
-- Les policies "org_isolation" existantes restent — un utilisateur passe
-- si l'UNE des policies le permet (Postgres OR entre policies).

-- workspaces : lecture seule pour les workspace members
CREATE POLICY "workspace_member_read" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- projects : accès complet pour les workspace members
CREATE POLICY "workspace_member_access" ON public.projects
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- statuses : accès complet pour les workspace members
CREATE POLICY "workspace_member_access" ON public.statuses
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- tasks : accès complet pour les workspace members
CREATE POLICY "workspace_member_access" ON public.tasks
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- tags : lecture pour les workspace members (pour voir les tags sur les tâches)
CREATE POLICY "workspace_member_read" ON public.tags
  FOR SELECT USING (
    org_id IN (
      SELECT w.org_id FROM public.workspaces w
      JOIN public.workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );
