"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            // Never retry client errors — a 429 (TMDB rate-limit) or 404 only burns
            // more quota when retried. One retry for transient network/5xx blips.
            retry: (failureCount, error) => {
              const msg = error instanceof Error ? error.message : String(error);
              if (/\b4\d\d\b/.test(msg)) return false;
              return failureCount < 1;
            },
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}