import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const JOLPICA_API_BASE = "https://api.jolpi.ca"

Deno.serve(async () => {
  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("HEGON_SECRET_KEY")!
    const supabaseClient     = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "sport" },
    })

    console.log("Fetching F1 2026 constructor standings from Jolpica API...")

    // 1. Fetch constructor standings
    const standingsResponse = await fetch(
      `${JOLPICA_API_BASE}/ergast/f1/2026/constructorstandings.json`
    )
    if (!standingsResponse.ok) {
      throw new Error(`Jolpica API error: ${standingsResponse.status} ${standingsResponse.statusText}`)
    }

    const standingsData = await standingsResponse.json()
    const standings     = standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || []

    if (standings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No constructor standings found for 2026" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${standings.length} constructors in standings`)

    // 2. Fetch race results pour calculer les podiums
    const resultsResponse = await fetch(
      `${JOLPICA_API_BASE}/ergast/f1/2026/results.json?limit=1000`
    )
    if (!resultsResponse.ok) {
      throw new Error(`Results API error: ${resultsResponse.status} ${resultsResponse.statusText}`)
    }

    const resultsData = await resultsResponse.json()
    const races       = resultsData?.MRData?.RaceTable?.Races || []

    // Calcul podiums par constructor
    const podiumCounts: Record<string, number> = {}
    for (const race of races) {
      for (const result of race.Results || []) {
        const position = parseInt(result.position)
        if (position >= 1 && position <= 3) {
          const constructorId = result.Constructor.constructorId
          podiumCounts[constructorId] = (podiumCounts[constructorId] || 0) + 1
        }
      }
    }

    console.log("Podium counts calculated")

    // 3. Batch-fetch toutes les équipes → Map<jolpica_constructor_id, uuid>
    const { data: teams, error: teamsError } = await supabaseClient
      .from("f1_teams")
      .select("id, jolpica_constructor_id")

    if (teamsError) throw new Error(`Error fetching teams: ${teamsError.message}`)

    const teamIdMap = new Map<string, string>(
      teams?.map((t: any) => [t.jolpica_constructor_id, t.id]) ?? []
    )
    console.log(`Mapped ${teamIdMap.size} teams`)

    // 4. Préparer upsert
    const standingsToUpsert = standings
      .map((standing: any) => {
        const constructorId = standing.Constructor.constructorId
        const teamId        = teamIdMap.get(constructorId)

        if (!teamId) {
          console.warn(`No team found for constructor: ${standing.Constructor.name} (${constructorId})`)
          return null
        }

        return {
          season:  2026,
          team_id: teamId,
          position: parseInt(standing.position),
          points:   parseFloat(standing.points),
          wins:     parseInt(standing.wins),
          podiums:  podiumCounts[constructorId] || 0,
        }
      })
      .filter(Boolean)

    console.log(`Upserting ${standingsToUpsert.length} constructor standings...`)

    // 5. Upsert
    const { error: upsertError } = await supabaseClient
      .from("f1_constructor_standings")
      .upsert(standingsToUpsert, { onConflict: "season,team_id" })

    if (upsertError) throw new Error(`Error upserting standings: ${upsertError.message}`)

    console.log("Constructor standings sync completed")

    return new Response(
      JSON.stringify({
        success:       true,
        message:       `Synced ${standingsToUpsert.length} constructor standings for 2026`,
        synced_count:  standingsToUpsert.length,
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    console.error("Edge Function Error:", error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
