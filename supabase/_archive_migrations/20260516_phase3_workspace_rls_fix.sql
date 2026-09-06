-- Phase 3 — Fix : dépendance circulaire dans les RLS workspace
-- Problème : workspace_member_read (workspaces) → workspace_members
--            workspace_members_select → workspaces  → boucle infinie
-- Solution : deux fonctions SECURITY DEFINER qui cassent la boucle

-- ── Fonctions SECURITY DEFINER ────────────────────────────────────────────────

-- Retourne les workspace_ids dont l'utilisateur est membre (via workspace_members)
-- SECURITY DEFINER = bypass RLS sur workspace_members → pas de récursion
CREATE OR REPLACE FUNCTION public.my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

-- Retourne les workspace_ids dont l'utilisateur est org-owner (via memberships)
-- SECURITY DEFINER = bypass RLS sur workspaces → pas de récursion
CREATE OR REPLACE FUNCTION public.my_org_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT w.id FROM public.workspaces w
  JOIN public.memberships m ON m.org_id = w.org_id
  WHERE m.user_id = auth.uid();
$$;

-- ── Recréer les policies workspace_members ────────────────────────────────────

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

-- SELECT : membre voit sa propre ligne + org-owner voit tous les membres de ses workspaces
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT * FROM public.my_org_workspace_ids())
  );

-- INSERT : seul l'org-owner peut ajouter des membres
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT * FROM public.my_org_workspace_ids())
  );

-- DELETE : seul l'org-owner peut retirer des membres
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    workspace_id IN (SELECT * FROM public.my_org_workspace_ids())
  );

-- ── Recréer workspace_member_read sur workspaces ──────────────────────────────

DROP POLICY IF EXISTS "workspace_member_read" ON public.workspaces;

CREATE POLICY "workspace_member_read" ON public.workspaces
  FOR SELECT USING (
    id IN (SELECT * FROM public.my_workspace_ids())
  );
