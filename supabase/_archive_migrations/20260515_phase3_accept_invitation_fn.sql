-- Phase 3 — RPC accept_invitation
-- Fonction SECURITY DEFINER pour accepter une invitation (bypasse RLS sur memberships)

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inv record;
BEGIN
  -- Trouver l'invitation valide
  SELECT * INTO inv
  FROM public.org_invitations
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invitation');
  END IF;

  -- Vérifier que le user est authentifié
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Vérifier que le user n'est pas déjà membre
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = inv.org_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Already a member of this organization');
  END IF;

  -- Créer le membership
  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (inv.org_id, auth.uid(), inv.role);

  -- Marquer l'invitation comme utilisée
  UPDATE public.org_invitations
  SET used_at = now()
  WHERE id = inv.id;

  RETURN json_build_object('success', true, 'org_id', inv.org_id);
END;
$$;
