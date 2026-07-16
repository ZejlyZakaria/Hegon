import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface JolpicaDriver {
  driverId:        string
  permanentNumber: string
  code:            string
  givenName:       string
  familyName:      string
  dateOfBirth:     string
  nationality:     string
}

Deno.serve(async () => {
  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase           = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "sport" },
    })

    console.log("Fetching F1 drivers for 2026 from Jolpica API...")

    const jolpicaResponse = await fetch("https://api.jolpi.ca/ergast/f1/2026/drivers.json")
    if (!jolpicaResponse.ok) {
      throw new Error(`Jolpica API error: ${jolpicaResponse.status}`)
    }

    const data                       = await jolpicaResponse.json()
    const drivers: JolpicaDriver[]   = data.MRData?.DriverTable?.Drivers || []

    if (drivers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No drivers found for 2026 season" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${drivers.length} drivers for 2026`)

    // Fetch standings pour récupérer les équipes actuelles
    const standingsResponse = await fetch("https://api.jolpi.ca/ergast/f1/2026/driverstandings.json")
    const driverTeamMap: Record<string, string> = {}

    if (standingsResponse.ok) {
      const standingsData = await standingsResponse.json()
      const standings     = standingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []

      for (const standing of standings) {
        const driverId     = standing.Driver?.driverId
        const constructorId = standing.Constructors?.[0]?.constructorId
        if (driverId && constructorId) {
          driverTeamMap[driverId] = constructorId
        }
      }
      console.log(`Found team assignments for ${Object.keys(driverTeamMap).length} drivers`)
    } else {
      console.warn("Could not fetch standings, teams will not be assigned")
    }

    // Map jolpica_constructor_id → team UUID
    const { data: teams, error: teamsError } = await supabase
      .from("f1_teams")
      .select("id, jolpica_constructor_id")

    if (teamsError) {
      console.error("Error fetching teams:", teamsError)
    }

    const teamIdMap: Record<string, string> = {}
    if (teams) {
      for (const team of teams) {
        teamIdMap[team.jolpica_constructor_id] = team.id
      }
      console.log(`Loaded ${teams.length} teams from database`)
    }

    const driverRecords = drivers.map((driver) => {
      const constructorId = driverTeamMap[driver.driverId]
      const teamId        = constructorId ? teamIdMap[constructorId] : null

      return {
        jolpica_driver_id: driver.driverId,
        permanent_number:  parseInt(driver.permanentNumber),
        code:              driver.code,
        given_name:        driver.givenName,
        family_name:       driver.familyName,
        nationality:       driver.nationality,
        date_of_birth:     driver.dateOfBirth,
        is_active:         true,
        current_team_id:   teamId,
      }
    })

    console.log("Inserting drivers into database...")

    const { data: insertedDrivers, error: insertError } = await supabase
      .from("f1_drivers")
      .upsert(driverRecords, { onConflict: "jolpica_driver_id", ignoreDuplicates: false })
      .select()

    if (insertError) throw insertError

    console.log(`Successfully inserted/updated ${insertedDrivers?.length || 0} drivers`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Seeded ${insertedDrivers?.length || 0} F1 drivers for 2026`,
        drivers: insertedDrivers,
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
