import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";

export async function getCurrentOrgId(): Promise<string> {
  const { orgId } = useOrgStore.getState();
  if (orgId) return orgId;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !data) throw new Error("No organization found for current user");
  return data.org_id;
}
