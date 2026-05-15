"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createClient } from "@/infrastructure/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface Options {
  channelName: string;
  table: string;
  schema?: string;
  filter?: string;
  onchange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  enabled?: boolean;
}

export function useRealtimeSync({
  channelName,
  table,
  schema = "public",
  filter,
  onchange,
  enabled = true,
}: Options) {
  const callbackRef = useRef(onchange);
  useLayoutEffect(() => { callbackRef.current = onchange; });

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase
      .channel(channelName)
      .on<Record<string, unknown>>(
        "postgres_changes",
        { event: "*", schema, table, ...(filter ? { filter } : {}) },
        (payload) => { callbackRef.current(payload); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, schema, filter, enabled]);
}
