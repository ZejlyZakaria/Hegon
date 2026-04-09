"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

// =====================================================
// TASKS PROVIDER
// Wraps React Query for data fetching + caching
// =====================================================

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 5 minutes (tasks don't change that often)
            staleTime: 1000 * 60 * 5,
            // Cache time: 10 minutes
            gcTime: 1000 * 60 * 10,
            // Refetch on window focus (when user comes back to tab)
            refetchOnWindowFocus: true,
            // Refetch on reconnect
            refetchOnReconnect: true,
            // Retry failed requests 3 times
            retry: 3,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* React Query Devtools (only in dev) */}
      {/* {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )} */}
    </QueryClientProvider>
  );
}