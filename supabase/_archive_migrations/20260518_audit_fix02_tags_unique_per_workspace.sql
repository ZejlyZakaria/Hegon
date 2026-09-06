-- =============================================================================
-- Audit fix — Tags unique constraint per workspace (not per user)
-- =============================================================================
-- Bug found by Zakaria: after Phase 7 (tags-per-workspace), the OLD unique
-- constraint `(user_id, name)` was never dropped. Effect: a user cannot create
-- a tag named "Bug" in workspace B if they already have a tag "Bug" in
-- workspace A → error 23505 duplicate key on tags_user_id_name_key.
--
-- The correct invariant: tag names are unique WITHIN a workspace, not
-- across all of the user's workspaces.
-- =============================================================================

-- Drop the obsolete user-scoped unique constraint
ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_user_id_name_key;

-- Create the new workspace-scoped unique constraint
-- Idempotent guard: drop first if a previous version of this migration ran
ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_workspace_id_name_key;

ALTER TABLE public.tags
  ADD CONSTRAINT tags_workspace_id_name_key UNIQUE (workspace_id, name);
