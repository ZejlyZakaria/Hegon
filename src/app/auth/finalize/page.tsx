"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/client";

export default function AuthFinalizePage() {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const supabase = createClient();

    const finalizeAuth = async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: workspace, error } = await supabase
            .from("workspaces")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1)
            .maybeSingle();

          if (error) {
            router.replace("/auth");
            return;
          }

          router.replace(workspace ? "/dashboard" : "/onboarding");
          router.refresh();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      router.replace("/auth");
    };

    void finalizeAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-sm text-zinc-400 tracking-wide">
        Finalizing sign in...
      </div>
    </div>
  );
}