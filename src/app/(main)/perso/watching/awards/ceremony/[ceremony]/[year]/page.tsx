import { notFound } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import { CeremonyClient } from "@/modules/watching/components/awards/CeremonyClient";

export default async function CeremonyPage({ params }: { params: Promise<{ ceremony: string; year: string }> }) {
  const { ceremony, year } = await params;
  if ((ceremony !== "oscars" && ceremony !== "emmys") || !/^\d{4}$/.test(year)) notFound();
  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return null;

  return <CeremonyClient userId={userId} ceremony={ceremony} year={Number(year)} />;
}
