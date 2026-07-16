import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface Circuit {
  id: string
  jolpica_circuit_id: string
  circuit_name: string
}

Deno.serve(async () => {
  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("HEGON_SECRET_KEY")!
    const supabase           = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "sport" },
    })

    // Année dynamique : on enrichit avec les résultats de l'année précédente
    const targetYear = new Date().getFullYear() - 1

    console.log(`Fetching circuits from database (target year: ${targetYear})...`)

    const { data: circuits, error: circuitsError } = await supabase
      .from("f1_circuits")
      .select("id, jolpica_circuit_id, circuit_name")

    if (circuitsError) throw circuitsError

    if (!circuits || circuits.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No circuits found in database" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${circuits.length} circuits`)

    const updates: any[] = []
    const errors: any[]  = []

    for (const circuit of circuits as Circuit[]) {
      console.log(`Fetching ${targetYear} results for ${circuit.circuit_name}...`)

      // 2s entre chaque requête — respect du rate limit Jolpica (200 req/hour)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const jolpicaUrl = `https://api.jolpi.ca/ergast/f1/${targetYear}/circuits/${circuit.jolpica_circuit_id}/results.json`
      const response   = await fetch(jolpicaUrl)

      if (!response.ok) {
        console.warn(`No ${targetYear} results for ${circuit.circuit_name}`)
        continue
      }

      const data  = await response.json()
      const races = data.MRData?.RaceTable?.Races || []

      if (races.length === 0) {
        console.warn(`No races found for ${circuit.circuit_name} in ${targetYear}`)
        continue
      }

      const lastRace = races[races.length - 1]
      const results  = lastRace.Results || []
      const winner   = results.find((r: any) => parseInt(r.position) === 1)

      if (!winner) {
        console.warn(`No winner found for ${circuit.circuit_name}`)
        continue
      }

      console.log(`Winner at ${circuit.circuit_name}: ${winner.Driver.givenName} ${winner.Driver.familyName}`)

      const { data: driver, error: driverError } = await supabase
        .from("f1_drivers")
        .select("id")
        .eq("jolpica_driver_id", winner.Driver.driverId)
        .maybeSingle()

      if (driverError || !driver) {
        console.warn(`Driver ${winner.Driver.driverId} not found in database`)
        errors.push({ circuit: circuit.circuit_name, driver: winner.Driver.driverId, reason: "Driver not in database" })
        continue
      }

      const { error: updateError } = await supabase
        .from("f1_circuits")
        .update({ last_winner_driver_id: driver.id, last_winner_year: targetYear })
        .eq("id", circuit.id)

      if (updateError) {
        console.error(`Error updating ${circuit.circuit_name}:`, updateError)
        errors.push({ circuit: circuit.circuit_name, error: updateError.message })
      } else {
        console.log(`Updated ${circuit.circuit_name} with winner`)
        updates.push({
          circuit: circuit.circuit_name,
          winner:  `${winner.Driver.givenName} ${winner.Driver.familyName}`,
          year:    targetYear,
        })
      }
    }

    console.log(`Completed: ${updates.length} circuits updated, ${errors.length} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updates.length} circuits with ${targetYear} winners`,
        updates,
        errors: errors.length > 0 ? errors : undefined,
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
