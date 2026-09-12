"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/client";
import { STALE } from "@/shared/lib/stale";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // LE défaut de toute l'app — le SEUL site où STALE.DEFAULT a le droit d'apparaître :
            // le sélecteur STALE_DEFAULT_IS_INHERITED (eslint.config.mjs) le refuse partout
            // ailleurs, d'où le disable ci-dessous. Les hooks héritent.
            // ⚠️ Sans cette ligne, TanStack retombe à 0 : tout refetch à chaque montage.
            // eslint-disable-next-line no-restricted-syntax -- c'est la DÉFINITION du défaut, pas une redéclaration
            staleTime: STALE.DEFAULT,
            // ⚠️ gcTime = combien de temps une donnée SANS observateur reste en mémoire. Un palier
            // au-dessus de 10 min ne vaut que si le hook déclare aussi un gcTime ≥ — sinon la
            // donnée est ramassée avant d'être périmée et le palier est un mensonge (voir stale.ts).
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