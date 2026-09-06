-- Phase 3 — Workspace Sharing
-- Migration : mise à jour de accept_invitation RPC
-- Si l'invitation a un workspace_id → crée un workspace_member
-- Sinon → comportement existant (crée un membership org)

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv    record;
  uid    uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO inv
  FROM public.org_invitations
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired');
  END IF;

  -- ── Workspace invitation ──────────────────────────────────────────────────
  IF inv.workspace_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = inv.workspace_id AND user_id = uid
    ) THEN
      RETURN json_build_object('error', 'already_member');
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
    VALUES (inv.workspace_id, uid, inv.role, inv.invited_by);

    UPDATE public.org_invitations SET used_at = now() WHERE id = inv.id;

    RETURN json_build_object(
      'success',      true,
      'type',         'workspace',
      'workspace_id', inv.workspace_id
    );

  -- ── Org invitation (comportement existant) ────────────────────────────────
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.memberships
      WHERE org_id = inv.org_id AND user_id = uid
    ) THEN
      RETURN json_build_object('error', 'already_member');
    END IF;

    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (inv.org_id, uid, inv.role);

    UPDATE public.org_invitations SET used_at = now() WHERE id = inv.id;

    RETURN json_build_object(
      'success', true,
      'type',    'org',
      'org_id',  inv.org_id
    );
  END IF;
END;
$$;
