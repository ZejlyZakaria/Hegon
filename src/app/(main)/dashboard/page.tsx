"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/client";
import DashboardHome from "@/modules/dashboard-os/components/DashboardHome";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Auth + onboarding check — non-blocking for render
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_OUT") router.replace("/auth");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return <DashboardHome />;
}
