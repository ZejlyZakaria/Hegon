"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/client";

export default function AuthFinalizePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const supabase = createClient();
    const rawTarget = searchParams.get("target") ?? "/dashboard";
    const target =
      rawTarget.startsWith("/") && !rawTarget.startsWith("//")
        ? rawTarget
        : "/dashboard";

    const run = async () => {
      for (let i = 0; i < 10; i++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: workspace } = await supabase
            .from("workspaces")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1)
            .maybeSingle();

          router.replace(workspace ? "/dashboard" : "/onboarding");
          router.refresh();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // fallback raisonnable
      router.replace("/auth");
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-[#a1a1aa]">
      Finalizing sign in...
    </div>
  );
}