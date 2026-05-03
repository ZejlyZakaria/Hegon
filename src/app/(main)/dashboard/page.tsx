"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/client";
import DashboardContent from "@/modules/dashboard/components/DashboardContent";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Auth + onboarding check — non-blocking for render
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace("/auth");
        return;
      }
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      if (!workspace) router.replace("/onboarding");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/auth");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] overflow-y-auto">
      <DashboardContent />
    </div>
  );
}
