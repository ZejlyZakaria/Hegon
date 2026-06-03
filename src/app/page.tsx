import { redirect } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import { DASHBOARD_MODULE, MODULES } from "@/shared/constants/modules";

// Home resolver: send the user to their preferred landing module (Settings →
// Home screen). The middleware already guarantees auth + a workspace here.
export default async function Home() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Missing table / no row → data is null → fall back to the dashboard.
  const { data } = await supabase
    .from("user_settings")
    .select("default_module")
    .eq("user_id", user.id)
    .maybeSingle();

  const key = data?.default_module ?? "dashboard";
  if (key === "dashboard") redirect(DASHBOARD_MODULE.route);

  const target = MODULES.find((m) => m.key === key && !m.comingSoon)?.route;
  redirect(target ?? DASHBOARD_MODULE.route);
}
