// supabase/functions/football_sync_season/index.ts
//
// SEASON ROLLOVER — the job that makes football "run itself" across seasons.
//
// football_sync_matches only refreshes a ±window (−4d→+10d) around now, so at a season change only a
// handful of near matches trickle in — never the FULL new-season calendar. This function does the
// bulk full-season fill of sport.football_matches for every FOLLOWED competition AND team:
//   • /competitions/{code}/matches  (no date filter → the WHOLE current season = the new season once
//     football-data publishes it, ~380 rows for a league) — feeds the competition page + team pages.
//   • /teams/{ext}/matches          (no date filter → that team's whole current season across comps) —
//     covers a followed team whose competition isn't followed.
// The `season` column is derived from each match's season.startDate, so the read side (getCompetition
// Matches filters to maxSeason) auto-switches to the new season with zero manual step. Old seasons stay
// (history: team-page season selector). Idempotent — upsert on external_match_id.
//
// Run it WEEKLY (fixtures reschedule; a new season is caught within 7 days). Low-frequency by design:
// ~6 comps + a few teams = a dozen calls, well under the free tier's 10 req/min with a 6.5s spacer.
//
// Invoked by a cron via internal.call_edge('football_sync_season', '{}') — the Bearer is only a gateway
// pass; this function builds its own privileged client from HEGON_SECRET_KEY. (CLAUDE.md §6bis.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async () => {
  try {
    const FOOTBALL_KEY = Deno.env.get("FOOTBALL_DATA_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const KEY          = Deno.env.get("HEGON_SECRET_KEY")
    if (!FOOTBALL_KEY || !SUPABASE_URL || !KEY) {
      return new Response("Missing environment variables", { status: 500 })
    }

    const readHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "sport" }
    const writeHeaders = {
      ...readHeaders,
      "Content-Type": "application/json",
      "Content-Profile": "sport",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }
    const sbGet = async (path: string) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: readHeaders })
      return r.ok ? await r.json() : []
    }

    // ── reference maps (competition + team id resolution) ──
    const comps = await sbGet("football_competitions?select=id,api_external_id,code")
    const teams = await sbGet("football_teams?select=id,api_external_id")
    const compIdByExt = new Map(comps.map((c: any) => [String(c.api_external_id), c.id]))
    const teamIdByExt = new Map(teams.map((t: any) => [String(t.api_external_id), t.id]))
    const teamExtByUuid = new Map(teams.map((t: any) => [t.id, String(t.api_external_id)]))
    const compCodeByUuid = new Map(comps.map((c: any) => [c.id, c.code || String(c.api_external_id)]))

    // ── what/who is followed ──
    const fc = await sbGet("football_user_competitions?select=competition_id")
    const compCodes = [...new Set(fc.map((x: any) => compCodeByUuid.get(x.competition_id)).filter(Boolean))]

    const settings = await sbGet("football_user_settings?select=main_team_id&main_team_id=not.is.null")
    const favs     = await sbGet("user_favorites?select=entity_id&entity_type=eq.football_team")
    const teamUuids = [...new Set([...settings.map((s: any) => s.main_team_id), ...favs.map((f: any) => f.entity_id)])]
    const teamExts = [...new Set(teamUuids.map((u) => teamExtByUuid.get(u)).filter(Boolean))]

    const mapRow = (m: any) => ({
      external_match_id: m.id,
      competition_id: compIdByExt.get(String(m.competition?.id)) ?? null,
      season: m.season?.startDate ? Number(String(m.season.startDate).slice(0, 4)) || null : null,
      utc_date: m.utcDate, status: m.status, matchday: m.matchday ?? null, stage: m.stage ?? null, group: m.group ?? null,
      venue: m.venue ?? null, attendance: m.attendance ?? null,
      home_team_external_id: String(m.homeTeam?.id), away_team_external_id: String(m.awayTeam?.id),
      home_team_name: m.homeTeam?.name ?? "", away_team_name: m.awayTeam?.name ?? "",
      home_team_id: teamIdByExt.get(String(m.homeTeam?.id)) ?? null, away_team_id: teamIdByExt.get(String(m.awayTeam?.id)) ?? null,
      home_score: m.score?.fullTime?.home ?? null, away_score: m.score?.fullTime?.away ?? null,
      home_score_ht: m.score?.halfTime?.home ?? null, away_score_ht: m.score?.halfTime?.away ?? null,
      winner: m.score?.winner ?? null, last_updated: m.lastUpdated ?? null, fetched_at: new Date().toISOString(),
    })

    const upsert = async (rows: any[]) => {
      if (!rows.length) return
      await fetch(`${SUPABASE_URL}/rest/v1/football_matches?on_conflict=external_match_id`, {
        method: "POST", headers: writeHeaders, body: JSON.stringify(rows),
      })
    }

    // No date filter → football-data returns the WHOLE current season for each source.
    const sources = [
      ...compCodes.map((code) => `https://api.football-data.org/v4/competitions/${code}/matches`),
      ...teamExts.map((ext) => `https://api.football-data.org/v4/teams/${ext}/matches`),
    ]

    let total = 0
    const perSource: any[] = []
    for (const url of sources) {
      const r = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_KEY } })
      if (r.ok) {
        const ms = (await r.json())?.matches ?? []
        await upsert(ms.map(mapRow))
        total += ms.length
        perSource.push({ url, count: ms.length })
      } else {
        console.warn(`football-data ${r.status} for ${url}`)
        perSource.push({ url, error: r.status })
      }
      await new Promise((res) => setTimeout(res, 6500)) // stay under 10 req/min
    }

    return new Response(
      JSON.stringify({ success: true, total, competitions: compCodes.length, teams: teamExts.length, perSource, timestamp: new Date().toISOString() }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (err: any) {
    console.error("football_sync_season error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
