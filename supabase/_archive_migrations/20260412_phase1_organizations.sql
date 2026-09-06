-- Phase 1 — Multi-tenancy
-- Migration 1 : tables organizations + memberships

-- ============================================================
-- TABLE : organizations
-- ============================================================
CREATE TABLE organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        UNIQUE NOT NULL,
  plan       text        NOT NULL DEFAULT 'free'
                         CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE : memberships
-- ============================================================
CREATE TABLE memberships (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role       text        NOT NULL
                         CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- ============================================================
-- INDEX : accès fréquents
-- ============================================================
CREATE INDEX idx_memberships_user_id ON memberships (user_id);
CREATE INDEX idx_memberships_org_id  ON memberships (org_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships   ENABLE ROW LEVEL SECURITY;

-- Un user voit uniquement les orgs dont il est membre
CREATE POLICY "organizations: members can select"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- Un user voit uniquement ses propres memberships
CREATE POLICY "memberships: self select"
  ON memberships
  FOR SELECT
  USING (user_id = auth.uid());
