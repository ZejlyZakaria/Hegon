-- Phase 3 — Workspace Sharing
-- Migration : table workspace_members
-- Permet d'inviter des collaborateurs à un workspace Tasks spécifique
-- sans leur donner accès à l'org entière (watching, sport, etc.)

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id      ON public.workspace_members(user_id);

-- RLS
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Le membre lui-même ou l'org owner peut voir les membres du workspace
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  );

-- Seul l'org owner peut ajouter/supprimer des membres
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  );

CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  );
