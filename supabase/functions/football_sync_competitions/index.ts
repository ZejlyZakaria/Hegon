import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ALLOWED_CODES = ["PD", "CL", "PL"]

serve(async () => {
  try {
    const FOOTBALL_KEY        = Deno.env.get("FOOTBALL_DATA_KEY")
    const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_KEY = Deno.env.get("HEGON_SECRET_KEY")

    if (!FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response("Missing environment variables", { status: 500 })
    }

    const writeHeaders = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "resolution=merge-duplicates",
      "Content-Profile": "sport",
    }

    const apiRes = await fetch("https://api.football-data.org/v4/competitions", {
      headers: { "X-Auth-Token": FOOTBALL_KEY },
    })

    if (!apiRes.ok) {
      throw new Error(`Football API error: ${apiRes.status} ${await apiRes.text()}`)
    }

    const data = await apiRes.json()
    const competitions = (data.competitions ?? []).filter((c: any) => ALLOWED_CODES.includes(c.code))

    if (competitions.length === 0) {
      console.warn("No matching competitions returned from API")
      return new Response(
        JSON.stringify({ success: false, message: "No competitions fetched" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    const results: any[] = []

    for (const comp of competitions) {
      console.log(`Inserting: ${comp.name} (${comp.code})`)

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/football_competitions?on_conflict=api_external_id`,
        {
          method: "POST",
          headers: writeHeaders,
          body: JSON.stringify({
            api_external_id: comp.id.toString(),
            name: comp.name,
            code: comp.code,
            country: comp.area?.name ?? null,
            emblem_url: comp.emblem ?? null,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.text()
        console.error(`Insert failed for ${comp.name}:`, err)
        results.push({ competition: comp.name, error: err })
      } else {
        results.push({ competition: comp.name, success: true })
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: results.filter(r => r.success).length, details: results }, null, 2),
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
