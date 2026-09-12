import { createClient } from "@/infrastructure/supabase/client";

// L'identité côté NAVIGATEUR, sans réseau — règle R2 de la doctrine (hq/rules/system-design.md).
//
// `auth.getUser()` fait un aller-retour vers Supabase Auth pour VÉRIFIER le jeton : ~150-300 ms,
// mesurés le 2026-09-13 en tête de chaque chargement de page (deux appels en série, 646 → 935 ms).
// Côté client, cette vérification est inutile : la base la refait sur CHAQUE requête (RLS lit le
// JWT), donc un jeton faux ou expiré échoue de toute façon à la première lecture. `getSession()`
// lit le jeton stocké localement — c'est le même motif que `useCurrentUserId`.
//
// `getUser()` garde sa place là où il faut prouver l'identité SANS passer par la base : le flux
// d'auth (callback, finalize) et les routes API qui font du travail privilégié.
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
