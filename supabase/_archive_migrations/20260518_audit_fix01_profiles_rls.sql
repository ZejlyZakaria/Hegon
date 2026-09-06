-- =============================================================================
-- Audit fix §5.1 — Restrict profiles visibility
-- =============================================================================
-- BEFORE: "Profiles are viewable by everyone" → any authenticated user could
--         list ALL emails, names, avatars in the database (GDPR privacy risk).
--
-- AFTER:  profiles are visible to:
--   1. The user themselves
--   2. Members of the same org (memberships)
--   3. Members of the same workspace (workspace_members)
--
-- This preserves the collaboration use case (assignee picker in CodySoft
-- workspace shows other members) while blocking enumeration.
-- =============================================================================

-- Drop the permissive policy (original) AND any previous version of this fix
-- (idempotent: safe to re-run even if v1 of this migration already executed)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "profiles_visible_to_org_or_workspace_mates" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self_only" ON profiles;

-- New SELECT policy: self + org-mates + workspace-mates (covers owner ↔ member)
CREATE POLICY "profiles_visible_to_org_or_workspace_mates" ON profiles
  FOR SELECT
  USING (
    -- Self
    id = auth.uid()
    -- Org-mate: any user in an org I am also a member of
    OR id IN (
      SELECT DISTINCT m1.user_id
      FROM memberships m1
      JOIN memberships m2 ON m1.org_id = m2.org_id
      WHERE m2.user_id = auth.uid()
    )
    -- Workspace member visible: members of any workspace I own OR am member of
    -- my_workspace_ids()     → workspaces I am in workspace_members of
    -- my_org_workspace_ids() → workspaces in orgs I have a membership in (= owner case)
    OR id IN (
      SELECT DISTINCT wm.user_id
      FROM workspace_members wm
      WHERE wm.workspace_id IN (SELECT * FROM my_workspace_ids())
         OR wm.workspace_id IN (SELECT * FROM my_org_workspace_ids())
    )
    -- Workspace owner visible: when I am a member of a workspace, I should see its owner
    OR id IN (
      SELECT DISTINCT w.user_id
      FROM workspaces w
      WHERE w.id IN (SELECT * FROM my_workspace_ids())
    )
  );

-- UPDATE remains self-only (preserve existing rule if present)
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "profiles_update_self_only" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
