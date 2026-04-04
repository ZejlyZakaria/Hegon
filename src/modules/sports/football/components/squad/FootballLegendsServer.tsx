// components/sports/football/FootballLegendsServer.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import FootballLegends from "./FootballLegends";

export default async function FootballLegendsServer({ userId }: { userId: string }) {
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema("sport")
    .from("football_legends")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  return <FootballLegends userId={userId} initialLegends={data ?? []} />;
}