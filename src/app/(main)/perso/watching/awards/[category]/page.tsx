import { createServerClient } from "@/infrastructure/supabase/server";
import { AwardCategoryClient } from "@/modules/watching/components/awards/AwardCategoryClient";

export default async function AwardCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return null;

  return <AwardCategoryClient userId={userId} categoryKey={category} />;
}
