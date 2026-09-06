-- Phase 6 — Fix 02 : restreindre la lecture des org_invitations
-- Avant : USING (true) → tout user authentifié pouvait énumérer
--          tous les tokens en attente.
-- Après : owner de l'org OU email = email du JWT.
-- La page /invite/[token] passe désormais par un RPC SECURITY DEFINER.

DROP POLICY IF EXISTS "invitations: public read by token" ON public.org_invitations;

CREATE POLICY "invitations: self or owner read" ON public.org_invitations
  FOR SELECT
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
    OR org_id IN (
      SELECT org_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RPC pour la page /invite/[token] :
-- permet de lire UNE invitation via son token (anonyme OK),
-- sans exposer la table entière.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  inv  record;
  org  record;
BEGIN
  SELECT * INTO inv
  FROM public.org_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, name, slug INTO org
  FROM public.organizations
  WHERE id = inv.org_id;

  RETURN json_build_object(
    'id',           inv.id,
    'org_id',       inv.org_id,
    'workspace_id', inv.workspace_id,
    'invited_by',   inv.invited_by,
    'email',        inv.email,
    'token',        inv.token,
    'role',         inv.role,
    'expires_at',   inv.expires_at,
    'used_at',      inv.used_at,
    'created_at',   inv.created_at,
    'org',          json_build_object('name', org.name, 'slug', org.slug)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
