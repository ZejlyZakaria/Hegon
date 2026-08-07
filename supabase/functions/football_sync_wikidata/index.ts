// supabase/functions/football_sync_wikidata/index.ts
//
// PRESTIGE layer — competition PAST WINNERS from Wikidata (the "roll of honour").
//
// For every competition carrying a wikidata_id, it asks Wikidata's SPARQL endpoint for each season's
// winner (P1346) via the season→competition link (P3450), and upserts (year, winner) into
// sport.football_competition_winners. The UI reads the DB, never Wikidata directly (cache-aside). Runs
// MONTHLY — a roll of honour only gains one row per competition per year.
//
// Only competition winners are automated: TEAM palmarès is deliberately NOT (Wikidata splits league
// titles across historical entities → wrong counts). No football-data key needed here — Wikidata is
// keyless; HEGON_SECRET_KEY is only for the DB writes. Invoked by a cron via
// internal.call_edge('football_sync_wikidata'). (CLAUDE.md §6bis.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const WD_ENDPOINT = "https://query.wikidata.org/sparql"
// Wikidata asks for a descriptive User-Agent identifying the app + a contact.
const WD_UA = "HEGON/1.0 (https://hegon.fr; football roll-of-honour sync)"

serve(async () => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const KEY          = Deno.env.get("HEGON_SECRET_KEY")
    if (!SUPABASE_URL || !KEY) return new Response("Missing environment variables", { status: 500 })

    const readHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "sport" }
    const writeHeaders = {
      ...readHeaders,
      "Content-Type": "application/json",
      "Content-Profile": "sport",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }

    // Competitions that have a curated Wikidata id.
    const compsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/football_competitions?select=id,code,wikidata_id&wikidata_id=not.is.null`,
      { headers: readHeaders },
    )
    if (!compsRes.ok) throw new Error(`competitions fetch failed: ${await compsRes.text()}`)
    const comps = await compsRes.json()

    const winnersQuery = (qid: string) => `
      SELECT ?season ?seasonLabel ?winner ?winnerLabel ?start ?pit WHERE {
        ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner .
        OPTIONAL { ?season wdt:P580 ?start. }
        OPTIONAL { ?season wdt:P585 ?pit. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`

    const results: any[] = []

    for (const c of comps) {
      const url = `${WD_ENDPOINT}?format=json&query=${encodeURIComponent(winnersQuery(c.wikidata_id))}`
      const r = await fetch(url, { headers: { "User-Agent": WD_UA, "Accept": "application/sparql-results+json" } })
      if (!r.ok) {
        console.warn(`Wikidata ${r.status} for ${c.code} (${c.wikidata_id})`)
        results.push({ code: c.code, error: r.status })
        await new Promise((res) => setTimeout(res, 1500))
        continue
      }
      const data = await r.json()
      const bindings = data?.results?.bindings ?? []

      // Key by the SEASON entity (QID) — the start-year is NOT unique (e.g. La Liga's 1929 + 1929–30
      // both start-year 1929). Dedupe by season QID; keep the first winner seen for it.
      const bySeason = new Map<string, { year: number | null; label: string; name: string; wid: string | null }>()
      for (const b of bindings) {
        const seasonQid = b.season?.value ? String(b.season.value).split("/").pop()! : null
        const name = b.winnerLabel?.value
        if (!seasonQid || !name) continue
        const iso = b.start?.value || b.pit?.value
        const year = iso ? Number(String(iso).slice(0, 4)) : null
        // The season's own label is authoritative for display ("2025–26 La Liga" → "2025/26", "1929").
        const raw = b.seasonLabel?.value || ""
        const m = raw.match(/^\d{4}(?:[–\-\/]\d{2,4})?/)
        const label = m ? m[0].replace(/[–-]/g, "/") : (year ? String(year) : "")
        if (!bySeason.has(seasonQid)) {
          bySeason.set(seasonQid, { year, label, name, wid: b.winner?.value ? String(b.winner.value).split("/").pop()! : null })
        }
      }

      const rows = [...bySeason.entries()].map(([season_wikidata_id, s]) => ({
        competition_id: c.id,
        season_wikidata_id,
        season_year: s.year,
        season_label: s.label,
        winner_name: s.name,
        winner_wikidata_id: s.wid,
      }))

      if (rows.length) {
        const up = await fetch(
          `${SUPABASE_URL}/rest/v1/football_competition_winners?on_conflict=competition_id,season_wikidata_id`,
          { method: "POST", headers: writeHeaders, body: JSON.stringify(rows) },
        )
        if (!up.ok) {
          console.error(`upsert failed for ${c.code}: ${await up.text()}`)
          results.push({ code: c.code, error: "upsert failed" })
          await new Promise((res) => setTimeout(res, 1500))
          continue
        }
      }

      results.push({ code: c.code, winners: rows.length })
      await new Promise((res) => setTimeout(res, 1500)) // be polite to WDQS
    }

    return new Response(JSON.stringify({ success: true, competitions: comps.length, results, timestamp: new Date().toISOString() }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (err: any) {
    console.error("football_sync_wikidata error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
