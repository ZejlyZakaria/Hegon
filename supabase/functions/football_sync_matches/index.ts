// supabase/functions/football_sync_matches/index.ts
//
// Keeps sport.football_matches FRESH (scores + statuses). Unlike the capped football_sync_next_matches
// (3 per team into football_next_matches), this refreshes the DURABLE full-calendar table. It only
// touches a WINDOW around now (−4d → +10d) for every FOLLOWED team AND followed competition — the
// matches whose status/score actually move — so it stays well under the free tier's 10 req/min.
// The initial full-season fill happens elsewhere (sync-team / sync-competition routes on follow).
//
// Invoked by a cron via internal.call_edge('football_sync_matches', '{}') — the Bearer is only a
// gateway pass; this function builds its own privileged client from HEGON_SECRET_KEY. (CLAUDE.md §6bis.)

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

    // ── who/what is followed ──
    const settings = await sbGet("football_user_settings?select=main_team_id&main_team_id=not.is.null")
    const favs     = await sbGet("user_favorites?select=entity_id&entity_type=eq.football_team")
    const teamUuids = [...new Set([...settings.map((s: any) => s.main_team_id), ...favs.map((f: any) => f.entity_id)])]
    const teamExts = [...new Set(teamUuids.map((u) => teamExtByUuid.get(u)).filter(Boolean))]

    const fc = await sbGet("football_user_competitions?select=competition_id")
    const compCodes = [...new Set(fc.map((x: any) => compCodeByUuid.get(x.competition_id)).filter(Boolean))]

    // ── window around now ──
    const day = (off: number) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10)
    const dateFrom = day(-4), dateTo = day(10)

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

    const sources = [
      ...teamExts.map((ext) => `https://api.football-data.org/v4/teams/${ext}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ...compCodes.map((code) => `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`),
    ]

    let total = 0
    for (const url of sources) {
      const r = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_KEY } })
      if (r.ok) {
        const ms = (await r.json())?.matches ?? []
        await upsert(ms.map(mapRow))
        total += ms.length
      } else {
        console.warn(`football-data ${r.status} for ${url}`)
      }
      await new Promise((res) => setTimeout(res, 6500)) // stay under 10 req/min
    }

    return new Response(JSON.stringify({ success: true, total, window: [dateFrom, dateTo], sources: sources.length, timestamp: new Date().toISOString() }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (err: any) {
    console.error("football_sync_matches error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
