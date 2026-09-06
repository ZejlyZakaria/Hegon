-- Phase 1 — Multi-tenancy
-- Migration 3 : fonction helper my_orgs()

-- Retourne tous les org_id dont l'utilisateur connecté est membre.
-- SECURITY DEFINER : s'exécute avec les droits du owner, pas de l'appelant.
-- STABLE : le résultat ne change pas dans une même transaction (optimisation query planner).

CREATE OR REPLACE FUNCTION public.my_orgs()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id
  FROM public.memberships
  WHERE user_id = auth.uid();
$$;

-- Accessible aux users authentifiés
GRANT EXECUTE ON FUNCTION public.my_orgs() TO authenticated;
