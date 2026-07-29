import { createServerClient } from "@/infrastructure/supabase/server";
import { ListsClient } from "@/modules/watching/components/lists/ListsClient";

export default async function ListsPage() {
  const supabase = await createServerClient();
  // Reverted getClaims() → getUser() (2026-07-29 prod-outage hotfix — see middleware.ts): getClaims'
  // in-process JWT verification began rejecting every valid token in prod. getUser() is authoritative.
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) return null;

  return <ListsClient userId={userId} />;
}
