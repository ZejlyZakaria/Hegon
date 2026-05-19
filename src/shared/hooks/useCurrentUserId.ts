import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/client";

// Synchronous read of the Supabase session from localStorage on first render.
// Avoids the double-pass where userId=null briefly disables downstream queries
// (skeleton flash on cold mount). Audit §2.7.
function readUserIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = Object.keys(window.localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    if (!key) return null;
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "null") as
      | { user?: { id?: string }; currentSession?: { user?: { id?: string } } }
      | null;
    return raw?.user?.id ?? raw?.currentSession?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(readUserIdFromStorage);

  useEffect(() => {
    const supabase = createClient();

    // Still resync once on mount in case the localStorage value was stale
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return userId;
}