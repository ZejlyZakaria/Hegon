import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface JolpicaResult {
  number:   string
  position: string
  points:   string
  Driver: {
    driverId:   string
    code:       string
    givenName:  string
    familyName: string
  }
  Constructor: {
    constructorId: string
  }
  grid:   string
  laps:   string
  status: string
  Time?: { time: string }
  FastestLap?: {
    rank: string
    lap:  string
    Time: { time: string }
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabaseClient     = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "sport" },
    })

    console.log("Starting F1 race results sync...")

    // 1. Récupérer les courses passées (race_date < now)
    const now                              = new Date().toISOString()
    const { data: racesToSync, error: racesError } = await supabaseClient
      .from("f1_races")
      .select("id, season, jolpica_round, race_date, status")
      .lt("race_date", now)
      .order("race_date", { ascending: false })
      .limit(10)

    if (racesError) throw new Error(`Error fetching races: ${racesError.message}`)

    if (!racesToSync || racesToSync.length === 0) {
      console.log("No past races to sync")
      return new Response(
        JSON.stringify({ message: "No past races to sync", synced: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${racesToSync.length} past races to process`)

    // 2. Batch-fetch tous les drivers une seule fois → Map<jolpica_driver_id, {id, teamId}>
    //    Élimine jusqu'à 200 SELECT individuels (20 résultats × 10 courses)
    const { data: allDrivers, error: driversError } = await supabaseClient
      .from("f1_drivers")
      .select("id, jolpica_driver_id, current_team_id")

    if (driversError) throw new Error(`Error fetching drivers: ${driversError.message}`)

    const driverMap = new Map<string, { id: string; teamId: string | null }>(
      allDrivers?.map((d: any) => [d.jolpica_driver_id, { id: d.id, teamId: d.current_team_id }]) ?? []
    )
    console.log(`Driver map loaded: ${driverMap.size} drivers`)

    let totalSynced  = 0
    let racesUpdated = 0

    for (const race of racesToSync) {
      console.log(`Processing ${race.season} Round ${race.jolpica_round}...`)

      const jolpicaUrl = `https://api.jolpi.ca/ergast/f1/${race.season}/${race.jolpica_round}/results.json`
      const response   = await fetch(jolpicaUrl)

      if (!response.ok) {
        console.error(`Failed to fetch results for ${race.season}/${race.jolpica_round}`)
        continue
      }

      const data                     = await response.json()
      const results: JolpicaResult[] = data?.MRData?.RaceTable?.Races?.[0]?.Results || []

      if (results.length === 0) {
        console.log(`No results for ${race.season}/${race.jolpica_round} (race may not have happened yet)`)
        continue
      }

      console.log(`Found ${results.length} results`)

      // 3. Update race status to 'completed'
      if (race.status !== "completed") {
        const { error: statusError } = await supabaseClient
          .from("f1_races")
          .update({ status: "completed" })
          .eq("id", race.id)

        if (statusError) {
          console.error("Error updating race status:", statusError)
        } else {
          console.log("Updated race status to 'completed'")
          racesUpdated++
        }
      }

      // 4. Upsert résultats — O(1) lookup depuis driverMap, zéro appel DB supplémentaire
      for (const result of results) {
        const driverEntry = driverMap.get(result.Driver.driverId)

        if (!driverEntry) {
          console.log(`Driver not found: ${result.Driver.driverId} (${result.Driver.code})`)
          continue
        }

        const hasFastestLap  = result.FastestLap?.rank === "1"
        const fastestLapTime = result.FastestLap?.Time?.time || null

        const resultData = {
          race_id:          race.id,
          driver_id:        driverEntry.id,
          team_id:          driverEntry.teamId,
          position:         parseInt(result.position),
          grid_position:    parseInt(result.grid),
          points:           parseFloat(result.points),
          laps:             parseInt(result.laps),
          time_result:      result.Time?.time || null,
          fastest_lap:      hasFastestLap,
          fastest_lap_time: fastestLapTime,
          status:           result.status,
        }

        const { error: upsertError } = await supabaseClient
          .from("f1_results")
          .upsert(resultData, { onConflict: "race_id,driver_id" })

        if (upsertError) {
          console.error(`Error upserting result for ${result.Driver.code}:`, upsertError)
        } else {
          console.log(`Synced P${result.position}: ${result.Driver.code}`)
          totalSynced++
        }
        // Pas de sleep ici — driverMap évite tout appel DB, pas de risque rate limit interne
      }

      // 2s entre chaque course — respect du rate limit Jolpica
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    console.log(`Sync complete. Results: ${totalSynced}, Races updated: ${racesUpdated}`)

    return new Response(
      JSON.stringify({
        message:             "Sync completed successfully",
        racesProcessed:      racesToSync.length,
        resultsSynced:       totalSynced,
        racesStatusUpdated:  racesUpdated,
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
