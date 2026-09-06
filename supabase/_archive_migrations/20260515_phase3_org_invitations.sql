-- Phase 3 — Invitation membres
-- Table org_invitations : liens d'invitation valides 7 jours

CREATE TABLE public.org_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  token       text        UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role        text        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'member', 'viewer')),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invitations_token  ON public.org_invitations(token);
CREATE INDEX idx_org_invitations_org_id ON public.org_invitations(org_id);

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- Owner peut voir/créer/supprimer les invitations de son org
CREATE POLICY "invitations: owner can manage"
  ON public.org_invitations
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Lecture publique par token (pour la page /invite/[token])
CREATE POLICY "invitations: public read by token"
  ON public.org_invitations
  FOR SELECT
  USING (true);
