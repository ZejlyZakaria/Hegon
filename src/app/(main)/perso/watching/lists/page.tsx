import { createServerClient } from "@/infrastructure/supabase/server";
import { ListsClient } from "@/modules/watching/components/lists/ListsClient";

export default async function ListsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return <ListsClient userId={user.id} />;
}
