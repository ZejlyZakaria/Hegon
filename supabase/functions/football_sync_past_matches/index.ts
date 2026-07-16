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
      "Prefer": "return=minimal,resolution=merge-duplicates",
    }

    console.log("Starting past matches sync...")

    // 1. Équipes principales
    const mainTeamsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/football_user_settings?select=main_team_id&main_team_id=not.is.null`,
      { headers: readHeaders }
    )
    if (!mainTeamsRes.ok) throw new Error(`Main teams fetch failed: ${await mainTeamsRes.text()}`)
    const mainTeamsData = await mainTeamsRes.json()
    if (!Array.isArray(mainTeamsData)) throw new Error("Main teams is not an array")

    // 2. Équipes favorites
    const favoritesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_favorites?select=entity_id&entity_type=eq.football_team`,
      { headers: readHeaders }
    )
    if (!favoritesRes.ok) throw new Error(`Favorites fetch failed: ${await favoritesRes.text()}`)
    const favoritesData = await favoritesRes.json()
    if (!Array.isArray(favoritesData)) throw new Error("Favorites is not an array")

    // 3. Fusion + déduplication
    const uniqueTeamUUIDs = [
      ...new Set([
        ...mainTeamsData.map((t: any) => t.main_team_id),
        ...favoritesData.map((f: any) => f.entity_id),
      ])
    ]

    if (!uniqueTeamUUIDs.length) {
      return new Response("No teams found", { status: 200 })
    }

    console.log(`Teams to sync: ${uniqueTeamUUIDs.length}`)

    // 4. Batch-fetch toutes les compétitions une seule fois → Map<api_external_id, uuid>
    //    Évite N×3 appels DB dans la boucle de matchs
    const competitionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/football_competitions?select=id,api_external_id`,
      { headers: readHeaders }
    )
    if (!competitionsRes.ok) throw new Error(`Competitions fetch failed: ${await competitionsRes.text()}`)
    const competitionsData = await competitionsRes.json()
    const competitionMap = new Map<string, string>(
      competitionsData.map((c: any) => [c.api_external_id, c.id])
    )
    console.log(`Competition map loaded: ${competitionMap.size} competitions`)

    // Helper cleanup (garde les 3 derniers matchs par équipe)
    const cleanupPastMatches = async (teamUUID: string): Promise<number> => {
      const matchesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/football_past_matches?team_id=eq.${teamUUID}&select=id,match_date&order=match_date.desc`,
        { headers: readHeaders }
      )
      if (!matchesRes.ok) return 0

      const matches = await matchesRes.json()
      if (!Array.isArray(matches) || matches.length <= 3) return 0

      const toDelete = matches.slice(3)
      const idsToDelete = toDelete.map((m: any) => m.id)

      const del = await fetch(
        `${SUPABASE_URL}/rest/v1/football_past_matches?id=in.(${idsToDelete.map((id: string) => `"${id}"`).join(",")})`,
        { method: "DELETE", headers: writeHeaders }
      )

      return del.ok ? toDelete.length : 0
    }

    const results: any[] = []
    let totalCleaned = 0

    // 5. Pour chaque équipe → 3 derniers matchs terminés
    for (const teamUUID of uniqueTeamUUIDs) {
      const teamRes = await fetch(
        `${SUPABASE_URL}/rest/v1/football_teams?id=eq.${teamUUID}&select=api_external_id`,
        { headers: readHeaders }
      )
      if (!teamRes.ok) { console.warn("Team fetch failed:", teamUUID); continue }

      const teamData = await teamRes.json()
      if (!Array.isArray(teamData) || !teamData.length) { console.warn("Team not found:", teamUUID); continue }

      const externalId = teamData[0].api_external_id

      const apiRes = await fetch(
        `https://api.football-data.org/v4/teams/${externalId}/matches?status=FINISHED&limit=3`,
        { headers: { "X-Auth-Token": FOOTBALL_KEY } }
      )
      if (!apiRes.ok) { console.warn("Football API failed:", externalId); continue }

      const data = await apiRes.json()
      const matches = data?.matches ?? []

      for (const match of matches) {
        const homeScore = match.score?.fullTime?.home ?? null
        const awayScore = match.score?.fullTime?.away ?? null

        if (homeScore === null || awayScore === null) {
          console.warn("Skipping match without score:", match.id)
          continue
        }

        // Lookup O(1) depuis le Map — zéro appel DB par match
        const competition_id = competitionMap.get(match.competition?.id?.toString()) ?? null

        const insertRes = await fetch(
          `${SUPABASE_URL}/rest/v1/football_past_matches?on_conflict=external_match_id,team_id&columns=team_id,competition_id,external_match_id,home_team_name,away_team_name,match_date,home_score,away_score,home_team_external_id,away_team_external_id`,
          {
            method: "POST",
            headers: writeHeaders,
            body: JSON.stringify({
              team_id: teamUUID,
              competition_id,
              external_match_id: match.id,
              home_team_name: match.homeTeam.name,
              away_team_name: match.awayTeam.name,
              match_date: match.utcDate,
              home_score: homeScore,
              away_score: awayScore,
              home_team_external_id: match.homeTeam.id.toString(),
              away_team_external_id: match.awayTeam.id.toString(),
            }),
          }
        )

        if (!insertRes.ok) {
          const err = await insertRes.text()
          console.error("Insert failed:", err)
          results.push({ teamUUID, matchId: match.id, error: err })
        } else {
          results.push({ teamUUID, matchId: match.id, success: true })
        }
      }

      // Cleanup top 3 par équipe
      const cleaned = await cleanupPastMatches(teamUUID)
      totalCleaned += cleaned

      // 500ms entre équipes pour éviter le rate limit
      await new Promise(r => setTimeout(r, 500))
    }

    console.log(`Past matches sync finished. Cleaned: ${totalCleaned}`)

    return new Response(
      JSON.stringify({
        success: true,
        details: results,
        teams_processed: uniqueTeamUUIDs.length,
        matches_cleaned: totalCleaned,
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
