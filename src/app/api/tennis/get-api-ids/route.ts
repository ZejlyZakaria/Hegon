/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/tennis/get-api-ids/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/infrastructure/supabase/server";
import { tennisRatelimit } from "@/shared/lib/ratelimit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const { success } = await tennisRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { playerIds } = await req.json();

    if (!playerIds || !Array.isArray(playerIds)) {
      return NextResponse.json({ apiIds: [] });
    }

    const validIds = playerIds.filter((id): id is string => typeof id === "string" && UUID_REGEX.test(id));
    if (validIds.length === 0) {
      return NextResponse.json({ apiIds: [] });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'sport' } }
    );

    const { data } = await adminClient
      .from("tennis_players")
      .select("thesportsdb_id")
      .in("id", validIds)
      .not("thesportsdb_id", "is", null);

    const apiIds = (data ?? [])
      .map(p => p.thesportsdb_id?.toString())
      .filter(Boolean);

    return NextResponse.json({ apiIds });

  } catch (err: any) {
    console.error("Get API IDs error:", err);
    return NextResponse.json({ apiIds: [] });
  }
}