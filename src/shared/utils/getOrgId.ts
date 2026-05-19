import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";

// In-flight memoization: when multiple services call getCurrentOrgId() in parallel
// at cold mount (Zustand orgId not yet hydrated), they all subscribe to the same
// promise instead of firing 4-6 duplicate `memberships` queries. Audit §3.3.
let inFlightOrgId: Promise<string> | null = null;

export async function getCurrentOrgId(): Promise<string> {
  const { orgId } = useOrgStore.getState();
  if (orgId) return orgId;

  if (inFlightOrgId) return inFlightOrgId;

  inFlightOrgId = (async () => {
    const supabase = createClient();
    // Order by created_at ASC: ensures multi-org users land on their first/personal org deterministically
    const { data, error } = await supabase
      .from("memberships")
      .select("org_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      inFlightOrgId = null; // allow retry
      throw new Error("No organization found");
    }
    return (data as { org_id: string }).org_id;
  })();

  try {
    return await inFlightOrgId;
  } finally {
    // Clear after resolution so a later orgId change (logout, accept invitation)
    // re-queries fresh. The hot path (orgId already in Zustand) skips this whole block.
    inFlightOrgId = null;
  }
}

// Exposed for signOut / clearOrg to drop any pending in-flight resolution
export function resetOrgIdCache(): void {
  inFlightOrgId = null;
}
