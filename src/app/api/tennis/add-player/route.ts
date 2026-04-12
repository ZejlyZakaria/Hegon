/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/tennis/add-player/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server"
import { createClient } from "@supabase/supabase-js";

// ── Helper pour extraire le nom de famille ────────────────────────────────
function extractLastName(fullName: string): string {
  // "Carlos Alcaraz" → "Alcaraz"
  // "Alexander Zverev" → "Zverev"
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Vérifier authentification ──────────────────────────────────────
    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Récupérer les données du joueur ────────────────────────────────
    const body = await req.json();
    const { idPlayer, strPlayer, strNationality, strThumb, strCutout, dateBorn } = body;

    if (!idPlayer || !strPlayer) {
      return NextResponse.json({ error: "Missing player data" }, { status: 400 });
    }

    // ── 3. Client admin pour bypass RLS ───────────────────────────────────
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'sport' } }
    );

    let playerUUID: string;

    // ── ÉTAPE 1 : Chercher par thesportsdb_id (exact match) ───────────────
    const { data: exactMatch } = await adminClient
      .from("tennis_players")
      .select("id")
      .eq("thesportsdb_id", parseInt(idPlayer))
      .maybeSingle();

    if (exactMatch) {
      // Joueur déjà avec thesportsdb_id → UPDATE
      playerUUID = exactMatch.id;
      
      await adminClient
        .from("tennis_players")
        .update({
          photo_thumb_url: strThumb ?? null,
          photo_cutout_url: strCutout ?? null,
          country: strNationality ?? null,
          birth_date: dateBorn ?? null,
          updated_at: new Date().toISOString()
        })
        .eq("id", playerUUID);
        
      console.log(`✅ Player ${strPlayer} updated (exact match by thesportsdb_id)`);
      
    } else {
      // ── ÉTAPE 2 : Chercher par nom de famille (fuzzy match) ─────────────
      const lastName = extractLastName(strPlayer);
      
      const { data: fuzzyMatches } = await adminClient
        .from("tennis_players")
        .select("id, name, thesportsdb_id")
        .ilike("name", `%${lastName}%`)
        .is("thesportsdb_id", null);

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Trouvé un match fuzzy → UPDATE
        const match = fuzzyMatches[0];
        playerUUID = match.id;
        
        await adminClient
          .from("tennis_players")
          .update({
            thesportsdb_id: parseInt(idPlayer),
            photo_thumb_url: strThumb ?? null,
            photo_cutout_url: strCutout ?? null,
            country: strNationality ?? null,
            birth_date: dateBorn ?? null,
            updated_at: new Date().toISOString()
          })
          .eq("id", playerUUID);
          
        console.log(`✅ Player "${match.name}" updated (fuzzy match with "${strPlayer}")`);
        
      } else {
        // ── ÉTAPE 3 : Aucun match → CREATE nouveau joueur ─────────────────
        const { data: created, error: createError } = await adminClient
          .from("tennis_players")
          .insert({
            thesportsdb_id: parseInt(idPlayer),
            name: strPlayer,
            country: strNationality ?? null,
            photo_thumb_url: strThumb ?? null,
            photo_cutout_url: strCutout ?? null,
            birth_date: dateBorn ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select("id")
          .single();

        if (createError) {
          console.error("❌ Create player error:", createError);
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        playerUUID = created.id;
        console.log(`✅ Player ${strPlayer} created (no match found)`);
      }
    }

    // ── 4. Récupérer l'org_id de l'user ──────────────────────────────────
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership?.org_id) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    // ── 5. Vérifier si déjà dans les favoris ──────────────────────────────
    const { data: existing } = await adminClient
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("entity_type", "tennis_player")
      .eq("entity_id", playerUUID)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ playerUUID, alreadyFavorite: true });
    }

    // ── 6. Ajouter aux favoris ────────────────────────────────────────────
    const { error: favError } = await adminClient
      .from("user_favorites")
      .insert({
        user_id: user.id,
        entity_type: "tennis_player",
        entity_id: playerUUID,
        org_id: membership.org_id,
        created_at: new Date().toISOString()
      });

    if (favError) {
      console.error("❌ Add favorite error:", favError);
      return NextResponse.json({ error: favError.message }, { status: 500 });
    }

    console.log(`✅ Player ${strPlayer} added to favorites (user: ${user.id})`);
    
    return NextResponse.json({ playerUUID, success: true });

  } catch (err: any) {
    console.error("❌ Add player error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}