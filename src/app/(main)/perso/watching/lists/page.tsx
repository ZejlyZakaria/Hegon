import { createServerClient } from "@/infrastructure/supabase/server";
import { ListsClient } from "@/modules/watching/components/lists/ListsClient";

export default async function ListsPage() {
  const supabase = await createServerClient();
  // The middleware verified this same JWT locally a few milliseconds ago. `getUser()` asked
  // Supabase Auth over the network to say it again — measured at 78.5ms against 0.47ms for the
  // local check, and the network floor to that host is 70.7ms, so the wait WAS the trip.
  // Same swap already made in the middleware and 5 API routes; these two pages were missed.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return null;

  return <ListsClient userId={userId} />;
}
