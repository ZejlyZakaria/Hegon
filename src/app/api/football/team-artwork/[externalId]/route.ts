// app/api/football/team-artwork/[externalId]/route.ts
//
// The team backdrop picker's data plane (mirrors Watching's artwork flow):
//   • GET  → the candidate backdrops for a team (fanart1-4 + banner) from TheSportsDB, on demand.
//   • POST → persist the chosen backdrop into football_teams.fanart_url (privileged write).
// Keyless (TheSportsDB v1) + the service role that's already in Vercel, so it works in prod without a
// football-data key. Auth-gated the same way the enrich route is.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTsdbTeam, collectBackdrops } from "@/modules/sports/football/lib/thesportsdb";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "sport" } });
}

async function loadTeam(externalId: string) {
  const db = adminClient();
  const { data } = await db.from("football_teams")
    .select("id, name, fanart_url")
    .eq("api_external_id", externalId).maybeSingle();
  return { db, team: data as { id: string; name: string; fanart_url: string | null } | null };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  if (!/^\d+$/.test(externalId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { team } = await loadTeam(externalId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const t = await resolveTsdbTeam(team.name);
  const backdrops = t ? await collectBackdrops(t) : [];
  return NextResponse.json({ current: team.fanart_url, backdrops });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  if (!/^\d+$/.test(externalId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url: unknown = body?.url;
  // Only accept a TheSportsDB image URL — never let an arbitrary URL be written into the shared row.
  if (typeof url !== "string" || !/^https:\/\/[a-z0-9.]*thesportsdb\.com\//i.test(url)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const { db, team } = await loadTeam(externalId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { error } = await db.from("football_teams").update({ fanart_url: url }).eq("id", team.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, fanart_url: url });
}
