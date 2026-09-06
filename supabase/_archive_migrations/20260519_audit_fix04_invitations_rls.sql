-- §5.3 org_invitations INSERT restricted to workspace owners
-- Defense-in-depth: service layer already checks ownership, DB enforces it too.

DROP POLICY IF EXISTS "org_invitations_insert_owner_only" ON org_invitations;

CREATE POLICY "org_invitations_insert_owner_only" ON org_invitations
  FOR INSERT WITH CHECK (
    -- Legacy org-level invitations (workspace_id IS NULL) are still allowed
    workspace_id IS NULL
    OR workspace_id IN (SELECT id FROM my_owned_workspace_ids())
  );
