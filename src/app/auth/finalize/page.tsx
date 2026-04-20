"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/client";

function AuthFinalizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const supabase = createClient();

    const rawTarget = searchParams.get("target") ?? "/dashboard";
    const target =
      rawTarget.startsWith("/") && !rawTarget.startsWith("//")
        ? rawTarget
        : "/dashboard";

    const finalizeAuth = async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          router.replace(target);
          router.refresh();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      router.replace("/auth");
    };

    void finalizeAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-sm text-zinc-400 tracking-wide">
        Finalizing sign in...
      </div>
    </div>
  );
}

export default function AuthFinalizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
          <div className="text-sm text-zinc-400 tracking-wide">
            Finalizing sign in...
          </div>
        </div>
      }
    >
      <AuthFinalizeContent />
    </Suspense>
  );
}
