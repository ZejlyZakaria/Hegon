import { redirect } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import OnboardingFlow from "@/modules/onboarding/components/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  // Workspace exists (owned or shared via workspace_members) → onboarding already done.
  // RLS gère le filtrage — pas besoin de .eq("user_id").
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (workspace) redirect("/dashboard");

  // Invited user → redirect to invite page instead of onboarding
  const { data: pendingInvite } = await supabase
    .from("org_invitations")
    .select("token")
    .eq("email", user.email ?? "")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .not("workspace_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (pendingInvite) redirect(`/invite/${pendingInvite.token}`);

  const userName =
    user.user_metadata?.full_name?.split(" ")[0] ??
    user.user_metadata?.name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  return <OnboardingFlow userId={user.id} userName={userName} />;
}
