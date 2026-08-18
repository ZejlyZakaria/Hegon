/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/football/enrich-team/[externalId]/route.ts
//
// On-demand team enrichment — called when a team page opens (fire-and-forget). Keyless external APIs
// (TheSportsDB + Wikidata) + a privileged DB write via the service role (which IS in Vercel), so this
// works in prod without a football-data key. Cached: re-enriches only if stale (>30 days).
//   • TheSportsDB  → fanart/banner/description/stadium capacity (+ thesportsdb_id)
//   • Wikidata     → the team's QID (smart-resolved, dodging the "multi-sport club" trap) + FULL honours
//                    filtered to a curated major-competition whitelist (no friendly/youth/regional noise)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTsdbTeam } from "@/modules/sports/football/lib/thesportsdb";

const WDQS = "https://query.wikidata.org/sparql";
const WD_UA = "HEGON/1.0 (https://hegon.fr; team enrichment)";

// Major competitions that count as a trophy → category (for grouping). Curated + verified.
const HONOURS_WHITELIST: Record<string, string> = {
  Q324867: "league", Q9448: "league", Q754839: "league", Q82595: "league", Q15805431: "league",
  Q15804: "league", Q13394: "league", Q167541: "league", Q182994: "league",
  Q483794: "domestic_cup", Q11151: "domestic_cup", Q150880: "domestic_cup",
  Q485997: "domestic_super", Q189188: "domestic_super", Q156973: "domestic_super", Q11152: "domestic_super", Q303844: "domestic_super",
  Q18756: "continental", Q18760: "continental", Q715496: "continental", Q40241: "continental", Q245375: "continental", Q184795: "continental", Q484028: "continental",
  Q223366: "world", Q182473: "world",
};

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "sport" } });
}

const sparql = async (q: string) => {
  const r = await fetch(`${WDQS}?format=json&query=${encodeURIComponent(q)}`, { headers: { "User-Agent": WD_UA, Accept: "application/sparql-results+json" }, cache: "no-store" });
  return r.ok ? (await r.json())?.results?.bindings ?? [] : [];
};

// Resolve a team name → Wikidata QID, but only accept an entity that is a football CLUB and has actually
// WON something — this skips the multi-sport parent club (e.g. Real Madrid Q6362982 vs the football Q8682).
async function resolveWikidataQid(name: string): Promise<string | null> {
  const s = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=7&search=${encodeURIComponent(name)}`, { headers: { "User-Agent": WD_UA } });
  if (!s.ok) return null;
  const cand = ((await s.json())?.search ?? []).map((x: any) => x.id).filter(Boolean);
  if (!cand.length) return null;
  const values = cand.map((q: string) => "wd:" + q).join(" ");
  const rows = await sparql(`SELECT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P31/wdt:P279* wd:Q476028 . ?s wdt:P1346 ?item . } LIMIT 1`);
  return rows[0]?.item?.value ? String(rows[0].item.value).split("/").pop()! : null;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  if (!/^\d+$/.test(externalId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const { data: team } = await db.from("football_teams")
    .select("id, name, thesportsdb_id, wikidata_id, website, founded, country, fanart_url, enriched_at")
    .eq("api_external_id", externalId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Fresh enough → nothing to do.
  if (team.enriched_at && Date.now() - new Date(team.enriched_at).getTime() < 30 * 86_400_000) {
    return NextResponse.json({ skipped: "fresh" });
  }

  const patch: Record<string, any> = { enriched_at: new Date().toISOString() };

  // ── TheSportsDB — images + meta (robust resolution: dodges the FC-suffix / women's-team traps) ──
  try {
    const t = await resolveTsdbTeam(team.name);
    if (t) {
      const newId = t.idTeam ?? null;
      // A CHANGED id means the previously-stored match was wrong (e.g. a women's team) → its stored
      // backdrop is wrong too, so RE-SEED it even though we normally never overwrite a chosen fanart.
      const idChanged = !!newId && newId !== team.thesportsdb_id;
      patch.thesportsdb_id = newId ?? team.thesportsdb_id;
      if (!team.fanart_url || idChanged) patch.fanart_url = t.strFanart1 || t.strFanart2 || null;
      patch.banner_url = t.strBanner || null;
      patch.description = t.strDescriptionEN || null;
      patch.stadium_capacity = t.intStadiumCapacity ? Number(t.intStadiumCapacity) || null : null;
      if (!team.website && t.strWebsite) patch.website = t.strWebsite;
      if (!team.founded && t.intFormedYear) patch.founded = Number(t.intFormedYear) || null;
      if (!team.country && t.strCountry) patch.country = t.strCountry;
    }
  } catch (e: any) { console.warn("TheSportsDB enrich failed:", e?.message); }

  // ── Wikidata QID (resolve if missing) ──
  let wid: string | null = team.wikidata_id ?? null;
  if (!wid) {
    try { wid = await resolveWikidataQid(team.name); if (wid) patch.wikidata_id = wid; }
    catch (e: any) { console.warn("Wikidata resolve failed:", e?.message); }
  }

  await db.from("football_teams").update(patch).eq("id", team.id);

  // ── Wikidata honours (whitelist) ──
  if (wid) {
    try {
      const values = Object.keys(HONOURS_WHITELIST).map((q) => "wd:" + q).join(" ");
      const rows = await sparql(`SELECT ?comp ?compLabel (COUNT(DISTINCT ?season) AS ?n) WHERE {
        VALUES ?comp { ${values} } ?season wdt:P3450 ?comp ; wdt:P1346 wd:${wid} .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } GROUP BY ?comp ?compLabel`);
      const honours = rows.map((b: any) => {
        const qid = String(b.comp.value).split("/").pop() ?? "";
        return { team_id: team.id, competition_qid: qid, competition_name: b.compLabel?.value ?? "", category: HONOURS_WHITELIST[qid] ?? null, titles: Number(b.n.value) || 0 };
      }).filter((h: any) => h.titles > 0 && h.competition_qid);

      await db.from("football_team_honours").delete().eq("team_id", team.id);
      if (honours.length) await db.from("football_team_honours").insert(honours);
    } catch (e: any) { console.warn("Wikidata honours failed:", e?.message); }
  }

  return NextResponse.json({ ok: true });
}
