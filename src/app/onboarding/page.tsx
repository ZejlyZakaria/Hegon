import { redirect } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import OnboardingFlow from "@/modules/onboarding/components/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  // Workspace exists → onboarding already done
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (workspace) redirect("/dashboard");

  const userName =
    user.user_metadata?.full_name?.split(" ")[0] ??
    user.user_metadata?.name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  return <OnboardingFlow userId={user.id} userName={userName} />;
}
