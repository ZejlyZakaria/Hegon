import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";

export async function getCurrentOrgId(): Promise<string> {
  const { orgId } = useOrgStore.getState();
  if (orgId) return orgId;

  // Query memberships directly — Supabase client handles auth headers via RLS
  // No explicit getSession() check to avoid race condition on cold reload
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .single();

  if (error || !data) throw new Error("No organization found");
  return data.org_id;
}
