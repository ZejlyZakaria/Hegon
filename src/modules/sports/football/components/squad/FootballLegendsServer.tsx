/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/infrastructure/supabase/client";
import FootballLegends from "./FootballLegends";

export default function FootballLegendsServer({ userId }: { userId: string }) {
  const [legends, setLegends] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("sport")
      .from("football_legends")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .then(({ data }) => setLegends(data ?? []));
  }, [userId]);

  return <FootballLegends userId={userId} initialLegends={legends} />;
}