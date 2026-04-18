import { useEffect, useState } from "react";
import { createClient } from "@/infrastructure/supabase/client";

export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
  }, []);

  return userId;
}