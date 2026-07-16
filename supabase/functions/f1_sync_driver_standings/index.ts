import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async () => {
  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("HEGON_SECRET_KEY")!
    const supabaseClient     = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "sport" },
    })

    console.log("Starting F1 driver standings sync...")

    const season = 2026

    // 1. Fetch standings
    const standingsUrl      = `https://api.jolpi.ca/ergast/f1/${season}/driverstandings.json`
    const response          = await fetch(standingsUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch standings: ${response.status}`)
    }

    const data      = await response.json()
    const standings = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []

    if (standings.length === 0) {
      console.log("No standings found")
      return new Response(
        JSON.stringify({ message: "No standings found", synced: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${standings.length} drivers in standings`)

    // 2. Fetch résultats pour calculer les podiums
    const resultsUrl      = `https://api.jolpi.ca/ergast/f1/${season}/results.json?limit=1000`
    const resultsResponse = await fetch(resultsUrl)

    // Vérification explicite avant .json()
    if (!resultsResponse.ok) {
      throw new Error(`Failed to fetch results: ${resultsResponse.status}`)
    }

    const resultsData = await resultsResponse.json()
    const races       = resultsData?.MRData?.RaceTable?.Races || []

    // Calcul podiums par pilote
    const podiumsCount: Record<string, number> = {}
    for (const race of races) {
      for (const result of race.Results || []) {
        const position = parseInt(result.position)
        if (position >= 1 && position <= 3) {
          const driverId = result.Driver.driverId
          podiumsCount[driverId] = (podiumsCount[driverId] || 0) + 1
        }
      }
    }

    console.log(`Calculated podiums for ${Object.keys(podiumsCount).length} drivers`)

    // 3. Batch-fetch tous les drivers une seule fois → Map<jolpica_driver_id, {id, teamId}>
    //    Élimine un appel DB par driver dans la boucle
    const { data: allDrivers, error: driversError } = await supabaseClient
      .from("f1_drivers")
      .select("id, jolpica_driver_id, current_team_id")

    if (driversError) throw new Error(`Error fetching drivers: ${driversError.message}`)

    const driverMap = new Map<string, { id: string; teamId: string | null }>(
      allDrivers?.map((d: any) => [d.jolpica_driver_id, { id: d.id, teamId: d.current_team_id }]) ?? []
    )
    console.log(`Driver map loaded: ${driverMap.size} drivers`)

    let syncedCount = 0

    // 4. Boucle standings — O(1) lookup, zéro appel DB supplémentaire
    for (const standing of standings) {
      const driverEntry = driverMap.get(standing.Driver.driverId)

      if (!driverEntry) {
        console.log(`Driver not found: ${standing.Driver.driverId}`)
        continue
      }

      const standingData = {
        season,
        driver_id: driverEntry.id,
        team_id:   driverEntry.teamId,
        position:  parseInt(standing.position),
        points:    parseFloat(standing.points),
        wins:      parseInt(standing.wins),
        podiums:   podiumsCount[standing.Driver.driverId] || 0,
      }

      const { error: upsertError } = await supabaseClient
        .from("f1_driver_standings")
        .upsert(standingData, { onConflict: "season,driver_id" })

      if (upsertError) {
        console.error(`Error upserting P${standing.position}:`, upsertError)
      } else {
        console.log(`Synced P${standing.position} (${standing.points} pts)`)
        syncedCount++
      }
    }

    console.log(`Sync complete. Total synced: ${syncedCount}`)

    return new Response(
      JSON.stringify({
        message:       "Sync completed successfully",
        season,
        driversSynced: syncedCount,
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    console.error("Edge Function Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
