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
      "Content-Profile": "sport",
    }

    const writeHeaders = {
      ...readHeaders,
      "Content-Type": "application/json",
      // return=representation → Supabase retourne la ligne insérée (UUID inclus), évite un re-fetch
      "Prefer": "return=representation,resolution=merge-duplicates",
    }

    // 1. Récupérer toutes les compétitions
    const competitionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/football_competitions?select=id,api_external_id`,
      { headers: readHeaders }
    )
    if (!competitionsRes.ok) {
      throw new Error(`Competitions fetch failed: ${await competitionsRes.text()}`)
    }
    const competitions = await competitionsRes.json()
    console.log(`${competitions.length} competitions to process`)

    const results: any[] = []

    for (const comp of competitions) {
      console.log(`Fetching teams for competition: ${comp.api_external_id}`)

      const apiRes = await fetch(
        `https://api.football-data.org/v4/competitions/${comp.api_external_id}/teams`,
        { headers: { "X-Auth-Token": FOOTBALL_KEY } }
      )

      if (!apiRes.ok) {
        console.warn(`API failed for competition ${comp.api_external_id}:`, await apiRes.text())
        continue
      }

      const data = await apiRes.json()
      const teams = Array.isArray(data.teams) ? data.teams : []

      for (const team of teams) {
        // Upsert équipe — return=representation renvoie la ligne avec l'UUID, pas besoin de re-fetch
        const teamRes = await fetch(
          `${SUPABASE_URL}/rest/v1/football_teams?on_conflict=api_external_id`,
          {
            method: "POST",
            headers: writeHeaders,
            body: JSON.stringify({
              api_external_id: team.id.toString(),
              name: team.name,
              short_name: team.shortName ?? null,
              tla: team.tla ?? null,
              crest_url: team.crest ?? null,
              founded: team.founded ?? null,
              venue: team.venue ?? null,
              // Rich club meta (free in the same call) → feeds the club fiche in the Team Panel v2.
              country: team.area?.name ?? null,
              club_colors: team.clubColors ?? null,
              website: team.website ?? null,
            }),
          }
        )

        if (!teamRes.ok) {
          console.error(`Team upsert failed: ${team.name}`, await teamRes.text())
          results.push({ team: team.name, error: "team upsert failed" })
          continue
        }

        const teamData = await teamRes.json()
        const team_id = teamData[0]?.id

        if (!team_id) {
          console.error(`No UUID returned for team: ${team.name}`)
          results.push({ team: team.name, error: "missing UUID after upsert" })
          continue
        }

        // Upsert relation team <-> competition
        const joinRes = await fetch(
          `${SUPABASE_URL}/rest/v1/football_team_competitions?on_conflict=team_id,competition_id`,
          {
            method: "POST",
            headers: { ...readHeaders, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({ team_id, competition_id: comp.id }),
          }
        )

        if (!joinRes.ok) {
          console.error(`Join upsert failed: ${team.name}`, await joinRes.text())
          results.push({ team: team.name, error: "join upsert failed" })
        } else {
          results.push({ team: team.name, success: true })
        }
      }

      // 6.5s entre compétitions : 13 compètes désormais → rester sous la limite football-data (10 req/min)
      await new Promise(r => setTimeout(r, 6500))
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
