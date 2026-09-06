-- Phase 3 — Workspace Sharing
-- Migration : ajout workspace_id sur org_invitations
-- Une invitation avec workspace_id = invitation workspace (Tasks)
-- Une invitation sans workspace_id = invitation org (comportement existant)

ALTER TABLE public.org_invitations
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_org_invitations_workspace_id ON public.org_invitations(workspace_id);
