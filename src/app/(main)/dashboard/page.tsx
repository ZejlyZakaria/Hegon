"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/client";
import DashboardContent from "@/modules/dashboard/components/DashboardContent";

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      const name =
        user.user_metadata?.full_name?.split(" ")[0] ??
        user.user_metadata?.name?.split(" ")[0] ??
        user.email?.split("@")[0] ??
        "there";
      setUserName(name);

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!workspace) router.replace("/onboarding");
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/auth");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!userName) return <div className="min-h-screen bg-[#09090b]" />;

  return (
    <div className="min-h-screen bg-[#09090b] overflow-y-auto">
      <DashboardContent />
    </div>
  );
}