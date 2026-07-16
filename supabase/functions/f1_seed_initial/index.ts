Deno.serve(async () => {
  try {
    const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
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
      "Content-Profile": "sport",
      "Prefer": "return=representation,resolution=merge-duplicates",
    }

    console.log("Starting F1 2026 seed...")

    // Fetch calendrier 2026 depuis Jolpica
    const jolpicaRes = await fetch("https://api.jolpi.ca/ergast/f1/2026.json")
    if (!jolpicaRes.ok) {
      throw new Error(`Jolpica API error: ${jolpicaRes.status}`)
    }

    const data = await jolpicaRes.json()
    const races = data.MRData?.RaceTable?.Races || []

    if (races.length === 0) {
      throw new Error("No races found for 2026")
    }

    console.log(`Fetched ${races.length} races from Jolpica`)

    // Mapping Jolpica circuit ID → nom de fichier SVG réel
    const CIRCUIT_SVG_MAPPING: Record<string, string | null> = {
      "albert_park":  "melbourne-1.svg",
      "suzuka":       "suzuka-1.svg",
      "shanghai":     "shanghai-1.svg",
      "miami":        "miami-1.svg",
      "monaco":       "monaco-1.svg",
      "catalunya":    "catalunya-1.svg",
      "villeneuve":   "montreal-1.svg",
      "silverstone":  "silverstone-1.svg",
      "hungaroring":  "hungaroring-1.svg",
      "spa":          "spa-francorchamps-1.svg",
      "zandvoort":    "zandvoort-1.svg",
      "monza":        "monza-1.svg",
      "baku":         "baku-1.svg",
      "marina_bay":   "marina-bay-1.svg",
      "americas":     "austin-1.svg",
      "red_bull_ring":"spielberg-1.svg",
      "rodriguez":    "mexico-city-1.svg",
      "interlagos":   "interlagos-1.svg",
      "vegas":        "las-vegas-1.svg",
      "yas_marina":   "yas-marina-1.svg",
      "bahrain":      null,
      "jeddah":       null,
      "losail":       null,
    }

    const CIRCUIT_COUNTRY_CODES: Record<string, string> = {
      "bahrain":      "BH",
      "jeddah":       "SA",
      "albert_park":  "AU",
      "suzuka":       "JP",
      "shanghai":     "CN",
      "miami":        "US",
      "monaco":       "MC",
      "catalunya":    "ES",
      "villeneuve":   "CA",
      "red_bull_ring":"AT",
      "silverstone":  "GB",
      "hungaroring":  "HU",
      "spa":          "BE",
      "zandvoort":    "NL",
      "monza":        "IT",
      "baku":         "AZ",
      "marina_bay":   "SG",
      "americas":     "US",
      "rodriguez":    "MX",
      "interlagos":   "BR",
      "vegas":        "US",
      "losail":       "QA",
      "yas_marina":   "AE",
    }

    const results: any[] = []
    const circuitMap: Record<string, string> = {}

    // ÉTAPE 1: Insert circuits — return=representation évite le re-fetch pour l'UUID
    for (const race of races) {
      const circuit = race.Circuit
      const svgFilename = CIRCUIT_SVG_MAPPING[circuit.circuitId]

      const circuitData = {
        jolpica_circuit_id: circuit.circuitId,
        circuit_name:       circuit.circuitName,
        locality:           circuit.Location.locality,
        country:            circuit.Location.country,
        country_code:       CIRCUIT_COUNTRY_CODES[circuit.circuitId] || "XX",
        latitude:           parseFloat(circuit.Location.lat),
        longitude:          parseFloat(circuit.Location.long),
        circuit_svg_url:    svgFilename ? `/assets/f1/circuits/${svgFilename}` : null,
      }

      const circuitInsertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/f1_circuits?on_conflict=jolpica_circuit_id`,
        { method: "POST", headers: writeHeaders, body: JSON.stringify(circuitData) }
      )

      if (!circuitInsertRes.ok) {
        const errorText = await circuitInsertRes.text()
        console.error(`Insert circuit error: ${circuit.circuitName}`, errorText)
        results.push({ circuit: circuit.circuitName, error: errorText })
        continue
      }

      // UUID récupéré directement depuis la réponse — zéro re-fetch
      const inserted = await circuitInsertRes.json()
      const circuit_id = inserted[0]?.id

      if (circuit_id) {
        circuitMap[circuit.circuitId] = circuit_id
        console.log(`Circuit inserted: ${circuit.circuitName}`)
      } else {
        console.warn(`No id returned for circuit: ${circuit.circuitName}`)
      }
    }

    console.log(`Inserted ${Object.keys(circuitMap).length} circuits`)

    // ÉTAPE 2: Insert races — on_conflict=season,round pour idempotence
    for (const race of races) {
      const circuit_id = circuitMap[race.Circuit.circuitId]

      if (!circuit_id) {
        console.error(`Circuit not found for race: ${race.raceName}`)
        continue
      }

      const raceData = {
        season:      parseInt(race.season),
        round:       parseInt(race.round),
        jolpica_round: parseInt(race.round),
        race_name:   race.raceName,
        circuit_id,
        race_date:   race.date,
        race_time:   race.time || null,
        quali_date:  race.Qualifying?.date || null,
        quali_time:  race.Qualifying?.time || null,
        status:      new Date(race.date) > new Date() ? "upcoming" : "completed",
        ergast_url:  `https://api.jolpi.ca/ergast/f1/${race.season}/${race.round}.json`,
      }

      const raceInsertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/f1_races?on_conflict=season,round`,
        { method: "POST", headers: writeHeaders, body: JSON.stringify(raceData) }
      )

      if (!raceInsertRes.ok) {
        const errorText = await raceInsertRes.text()
        console.error(`Insert race error: ${race.raceName}`, errorText)
        results.push({ race: race.raceName, error: errorText })
      } else {
        console.log(`Race inserted: ${race.raceName}`)
        results.push({ race: race.raceName, success: true })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "F1 2026 seed completed",
        stats: {
          circuits: Object.keys(circuitMap).length,
          races: results.filter((r) => r.success).length,
        },
        details: results,
      }, null, 2),
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
