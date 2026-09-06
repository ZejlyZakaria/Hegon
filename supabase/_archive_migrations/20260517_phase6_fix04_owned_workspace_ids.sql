-- Phase 6 — Fix 04 : restreindre INSERT/DELETE workspace_members aux owners
-- Avant : tout membre de l'org (role quelconque) pouvait ajouter / retirer
--          des workspace_members → escalade de privilèges intra-org.
-- Après : seul le owner de l'org.

CREATE OR REPLACE FUNCTION public.my_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT w.id
  FROM public.workspaces w
  JOIN public.memberships m
    ON m.org_id = w.org_id
   AND m.user_id = auth.uid()
   AND m.role = 'owner';
$$;

GRANT EXECUTE ON FUNCTION public.my_owned_workspace_ids() TO authenticated;

-- ── Recréer les policies INSERT / DELETE en owner-only ────────────────────────
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT * FROM public.my_owned_workspace_ids())
  );

CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    workspace_id IN (SELECT * FROM public.my_owned_workspace_ids())
  );
