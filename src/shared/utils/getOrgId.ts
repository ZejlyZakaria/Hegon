import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";

/**
 * Retourne l'org_id de l'utilisateur connecté.
 * Utilise le store Zustand si disponible (évite un appel DB),
 * sinon fallback sur un appel memberships.
 */
export async function getCurrentOrgId(): Promise<string> {
  // Zustand store (getState fonctionne en dehors de React)
  const { orgId } = useOrgStore.getState();
  if (orgId) return orgId;

  // Fallback DB
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .single();

  if (error || !data) throw new Error("No organization found for current user");
  return data.org_id;
}
