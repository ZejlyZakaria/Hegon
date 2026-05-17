"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
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

  // Suffix unique par instance — évite les collisions de channel si
  // deux composants montent la même sub en parallèle ou si un remount
  // arrive avant que le cleanup précédent n'ait fini.
  const instanceId = useId();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`${channelName}-${instanceId}`)
      .on<Record<string, unknown>>(
        "postgres_changes",
        { event: "*", schema, table, ...(filter ? { filter } : {}) },
        (payload) => { callbackRef.current(payload); }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[useRealtimeSync] "${channelName}" status=${status}`, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, schema, filter, enabled, instanceId]);
}
