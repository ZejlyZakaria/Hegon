import { redirect } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import OnboardingFlow from "@/modules/onboarding/components/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  // User already configured → skip onboarding
  const [{ data: favorites }, { data: mediaItems }] = await Promise.all([
    supabase
      .schema("sport")
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
    supabase
      .schema("watching")
      .from("media_items")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);

  if (favorites?.length || mediaItems?.length) {
    redirect("/dashboard");
  }

  const userName =
    user.user_metadata?.full_name?.split(" ")[0] ??
    user.user_metadata?.name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  return <OnboardingFlow userId={user.id} userName={userName} />;
}
