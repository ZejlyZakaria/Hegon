import { createServerClient } from "@/infrastructure/supabase/server";
import { AwardsClient } from "@/modules/watching/components/awards/AwardsClient";

// THE MUSEUM — same thin shell as /lists: the JWT was verified locally by the middleware a few
// milliseconds ago, `getClaims()` reads it without a network trip (78 ms saved per visit).
export default async function AwardsPage() {
  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return null;

  return <AwardsClient userId={userId} />;
}
