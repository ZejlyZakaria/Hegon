// Daily refresh of the GLOBAL "Don't Miss" cache (watching.trending_cache).
// Fetches TMDB trending + discover for each media type and stores the raw list
// objects { trending, recommendations } — one shared row per type. Mirrors exactly
// what getWatchingHeroData used to fetch live, so the client output is identical.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMDB = "https://api.themoviedb.org/3";
const KEY = Deno.env.get("TMDB_API_KEY")!;

type MType = "film" | "serie" | "anime";
const TYPES: MType[] = ["film", "serie", "anime"];

async function tmdb(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ api_key: KEY, language: "en-US", ...params });
  const res = await fetch(`${TMDB}/${path}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
  return res.json();
}

function endpointsFor(type: MType) {
  const trendingEndpoint = type === "film" ? "trending/movie/week" : "discover/tv";
  const trendingParams: Record<string, string> =
    type === "anime"
      ? { sort_by: "popularity.desc", with_genres: "16", with_origin_country: "JP", "vote_average.gte": "7", "vote_count.gte": "100" }
      : type === "serie"
      ? { sort_by: "popularity.desc", without_genres: "16", "vote_average.gte": "7", "vote_count.gte": "100" }
      : {};
  const recoEndpoint = type === "film" ? "discover/movie" : "discover/tv";
  const recoParams: Record<string, string> =
    type === "film"
      ? { "vote_average.gte": "7.5", "vote_count.gte": "50", sort_by: "release_date.desc", page: "1" }
      : type === "serie"
      ? { "vote_average.gte": "7.5", "vote_count.gte": "50", sort_by: "first_air_date.desc", without_genres: "16", page: "1" }
      : { "vote_average.gte": "7.5", "vote_count.gte": "50", sort_by: "first_air_date.desc", with_genres: "16", with_origin_country: "JP", page: "1" };
  return { trendingEndpoint, trendingParams, recoEndpoint, recoParams };
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const rows = [];
    for (const type of TYPES) {
      const { trendingEndpoint, trendingParams, recoEndpoint, recoParams } = endpointsFor(type);
      const [trendingData, recoData] = await Promise.all([
        tmdb(trendingEndpoint, trendingParams),
        tmdb(recoEndpoint, recoParams),
      ]);
      const trending =
        (trendingData.results ?? []).find((m: any) => m.vote_average >= 7 && m.vote_count >= 100) ??
        trendingData.results?.[0] ?? null;
      const recommendations = (recoData.results ?? []).slice(0, 8);
      rows.push({ type, items: { trending, recommendations }, refreshed_at: new Date().toISOString() });
    }

    const { error } = await supabase
      .schema("watching").from("trending_cache")
      .upsert(rows, { onConflict: "type" });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, refreshed: rows.map((r) => r.type) }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
