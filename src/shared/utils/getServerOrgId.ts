import { createServerClient } from "@/infrastructure/supabase/server";

/**
 * Retourne l'org_id de l'utilisateur connecté côté serveur.
 * À utiliser dans les Server Components et pages server-side.
 * Note : les RLS policies gèrent déjà l'isolation par org automatiquement.
 * Ce helper est utile pour passer orgId explicitement aux service functions.
 */
export async function getServerOrgId(userId: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return data?.org_id ?? null;
}
