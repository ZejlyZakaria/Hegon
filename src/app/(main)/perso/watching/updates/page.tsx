import { createServerClient } from "@/infrastructure/supabase/server";
import { UpdatesPage } from "@/modules/watching/components/updates/UpdatesPage";

export default async function WatchingUpdatesPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? <UpdatesPage userId={userId} /> : null;
}
