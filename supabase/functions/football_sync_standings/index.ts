import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async () => {
  try {
    const FOOTBALL_KEY         = Deno.env.get("FOOTBALL_DATA_KEY")
    const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_KEY = Deno.env.get("HEGON_SECRET_KEY")

    if (!FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response("Missing environment variables", { status: 500 })
    }

    const readHeaders = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Accept-Profile": "sport",
    }

    const writeHeaders = {
      ...readHeaders,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates",
      "Content-Profile": "sport",
    }

    // 1. Récupérer les compétitions
    const competitionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/football_competitions?select=id,api_external_id`,
      { headers: readHeaders }
    )
    if (!competitionsRes.ok) {
      throw new Error(`Competitions fetch failed: ${await competitionsRes.text()}`)
    }
    const competitions = await competitionsRes.json()

    // 2. Batch-fetch toutes les équipes une seule fois → Map<api_external_id, uuid>
    //    Élimine N appels DB séquentiels dans la boucle de classement
    const teamsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/football_teams?select=id,api_external_id`,
      { headers: readHeaders }
    )
    if (!teamsRes.ok) {
      throw new Error(`Teams fetch failed: ${await teamsRes.text()}`)
    }
    const teamsData = await teamsRes.json()
    const teamMap = new Map<string, string>(
      teamsData.map((t: any) => [t.api_external_id, t.id])
    )
    console.log(`Team map loaded: ${teamMap.size} teams`)

    const results: any[] = []

    for (const comp of competitions) {
      console.log(`Fetching standings for competition: ${comp.api_external_id}`)

      const apiRes = await fetch(
        `https://api.football-data.org/v4/competitions/${comp.api_external_id}/standings`,
        { headers: { "X-Auth-Token": FOOTBALL_KEY } }
      )

      if (!apiRes.ok) {
        console.warn(`API failed for competition ${comp.api_external_id}:`, await apiRes.text())
        continue
      }

      const data = await apiRes.json()
      const table = data?.standings?.[0]?.table ?? []

      for (const row of table) {
        // Lookup O(1) depuis le Map — zéro appel DB
        const team_id = teamMap.get(row.team.id.toString())

        if (!team_id) {
          console.warn(`Team not in map: ${row.team.name} (${row.team.id})`)
          results.push({ team: row.team.name, error: "not found in team map" })
          continue
        }

        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/football_standings?on_conflict=competition_id,team_id`,
          {
            method: "POST",
            headers: writeHeaders,
            body: JSON.stringify({
              competition_id: comp.id,
              team_id,
              played_games: row.playedGames,
              won: row.won,
              draw: row.draw,
              lost: row.lost,
              points: row.points,
              goals_for: row.goalsFor,
              goals_against: row.goalsAgainst,
              goal_difference: row.goalDifference,
            }),
          }
        )

        if (!res.ok) {
          const err = await res.text()
          console.error(`Standing upsert failed: ${row.team.name}`, err)
          results.push({ team: row.team.name, error: err })
        } else {
          results.push({ team: row.team.name, success: true })
        }
      }

      // 1s entre compétitions pour éviter le rate limit
      await new Promise(r => setTimeout(r, 1000))
    }

    return new Response(
      JSON.stringify({ success: true, details: results }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (err: any) {
    console.error("Edge Function Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
