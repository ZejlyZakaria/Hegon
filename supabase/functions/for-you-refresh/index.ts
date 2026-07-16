// For You — recommendation refresh (Supabase Edge Function, Deno).
//
// Runs on a cron (every ~5 days) entirely inside Supabase. For each user/type it:
//   1. takes a rotating window of their favorites (weighted by THEIR rating) plus
//      a few want-to-watch titles (lower weight) as seeds,
//   2. asks TMDB "more like this" per seed, keeps the best few (quality-gated,
//      excludes anything already in the library),
//   3. scores each candidate by how strongly the user's taste points at it
//      (sum of seed weights) with a light TMDB-quality nudge,
//   4. dedups franchises (no 3× Guardians),
//   5. selects the final ~20 with MMR (Maximal Marginal Relevance): each pick is
//      penalised for genre-overlap with those already chosen, so the list stays
//      tailored but ONE cluster (e.g. superhero) can't flood it,
//   6. flags newcomers vs the previous rotation (is_new) and upserts the row.
// The app just reads that table → For You is always instant.
//
// Env (function secrets): TMDB_API_KEY, HEGON_SECRET_KEY. SUPABASE_URL is auto-injected.
//   HEGON_SECRET_KEY replaces the auto-injected SUPABASE_SERVICE_ROLE_KEY, whose value IS the legacy
//   JWT — disabling JWT-based API keys kills it, so nothing may read it any more.
// Deploy:  supabase functions deploy for-you-refresh
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MediaType = "film" | "serie" | "anime";

// Minimum watched titles of a type before For You activates — enough signal to
// recommend, low enough not to leave a heavy user staring at an empty section.
const WATCHED_THRESHOLD: Record<MediaType, number> = { film: 20, serie: 5, anime: 5 };
const SEED_FAVORITES = 20;       // favorites used as seeds per window (rotating)
const SEED_WANT = 5;             // want-to-watch seeds (lower weight)
const WANT_WEIGHT = 0.4;         // want seed weight (below any favorite's 0.5–1.0)
const PER_SEED_KEEP = 5;         // recs kept per seed (wider pool → better MMR)
const STORE_COUNT = 20;          // how many to persist (carousel shows 10)
const WINDOW_DAYS = 5;           // rotation window
const MIN_VOTE_AVERAGE = 7.0;
const MMR_LAMBDA = 0.5;          // diversity strength (0 = pure relevance, 1 = pure variety)

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdb(key: string, endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const search = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const res = await fetch(`${TMDB_BASE}/${endpoint}?${search.toString()}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// Deterministic rotating window: walks through the whole pool over time so every
// favorite eventually drives recommendations (not just the top-rated ones).
function pickWindow(pool: number[], size: number, windowIndex: number): number[] {
  if (pool.length <= size) return pool;
  const start = ((windowIndex * size) % pool.length + pool.length) % pool.length;
  const out: number[] = [];
  for (let i = 0; i < size; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

// Franchise root of a title — used to drop near-duplicates (Guardians 1/2/3 →
// one entry). Cuts at a subtitle separator (": " / " - " / en-dash, but NOT an
// intra-word hyphen like Spider-Man) and strips trailing sequel markers.
function franchiseKey(title: string): string {
  let t = (title ?? "").toLowerCase();
  const sep = t.match(/:| - |–/);
  if (sep && sep.index !== undefined && sep.index > 0) t = t.slice(0, sep.index);
  t = t.replace(/\b(vol|volume|part|chapter|season|episode|the movie|the final)\b.*$/g, "");
  t = t.replace(/\s+([0-9]+|i{1,3}|iv|vi{0,3}|ix|x)\s*$/g, " "); // trailing number / roman numeral
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

// Genre overlap of two candidates (Jaccard on TMDB genre_ids) → the "similarity"
// the MMR penalty acts on.
function jaccard(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface Candidate {
  item: any;
  relevance: number;
  genres: Set<number>;
  fkey: string;
}

async function refreshUserType(
  supabase: any,
  tmdbKey: string,
  userId: string,
  type: MediaType,
): Promise<boolean> {
  const tmdbType = type === "film" ? "movie" : "tv";
  const minVoteCount = type === "film" ? 200 : 50;

  const tbl = () => supabase.schema("watching").from("media_items");

  const [watchedRes, favRes, wantRes, ownedRes, prevRes] = await Promise.all([
    tbl().select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", type).eq("watched", true),
    tbl().select("tmdb_id, user_rating")
      .eq("user_id", userId).eq("type", type).eq("favorite", true)
      .not("user_rating", "is", null).order("user_rating", { ascending: false }),
    tbl().select("tmdb_id")
      .eq("user_id", userId).eq("type", type).eq("want_to_watch", true)
      .order("created_at", { ascending: false }),
    tbl().select("tmdb_id").eq("user_id", userId).eq("type", type),
    supabase.schema("watching").from("for_you_cache")
      .select("items").eq("user_id", userId).eq("type", type).maybeSingle(),
  ]);

  const watchedCount = watchedRes.count ?? 0;
  const favorites = (favRes.data ?? []) as { tmdb_id: number; user_rating: number }[];
  if (watchedCount < WATCHED_THRESHOLD[type] || favorites.length === 0) return false;

  const windowIndex = Math.floor(Date.now() / (WINDOW_DAYS * 86_400_000));
  const favRating = new Map(favorites.map((f) => [f.tmdb_id, f.user_rating]));
  const favSeedIds = pickWindow(favorites.map((f) => f.tmdb_id), SEED_FAVORITES, windowIndex);
  const wantSeedIds = pickWindow((wantRes.data ?? []).map((w: any) => w.tmdb_id), SEED_WANT, windowIndex);

  const owned = new Set((ownedRes.data ?? []).map((o: any) => o.tmdb_id));
  const prevIds = new Set(((prevRes.data?.items ?? []) as any[]).map((i) => i.id));
  const hadPrev = prevIds.size > 0;

  // A favorite you rated 9.5 should pull harder than one rated 8 → seed weight is
  // the favorite's own rating (clamped 0.5–1.0). want-to-watch sit below at 0.4.
  const seedDefs = [
    ...favSeedIds.map((id) => ({
      id,
      weight: Math.min(1, Math.max(0.5, (favRating.get(id) ?? 8) / 10)),
    })),
    ...wantSeedIds.map((id) => ({ id, weight: WANT_WEIGHT })),
  ];

  // candidate id → { item, accumulated taste score }
  const scored = new Map<number, { item: any; score: number }>();

  await Promise.all(seedDefs.map(async ({ id, weight }) => {
    const recs = await tmdb(tmdbKey, `${tmdbType}/${id}/recommendations`, { page: "1" })
      .then((d) => d.results ?? [])
      .catch(() => [] as any[]);
    const kept = recs
      .filter((r: any) =>
        !owned.has(r.id) &&
        (r.vote_average ?? 0) >= MIN_VOTE_AVERAGE &&
        (r.vote_count ?? 0) >= minVoteCount)
      .sort((a: any, b: any) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, PER_SEED_KEEP);
    for (const r of kept) {
      const cur = scored.get(r.id);
      if (cur) cur.score += weight;
      else scored.set(r.id, { item: r, score: weight });
    }
  }));

  // Don't wipe a good list on a transient empty result (TMDB hiccup, etc.).
  if (scored.size === 0) return false;

  // Relevance = taste score, lightly modulated by TMDB quality (taste dominates).
  const candidates: Candidate[] = [...scored.values()].map(({ item, score }) => {
    const quality = Math.min(1, Math.max(0, (item.vote_average ?? 0) / 10));
    return {
      item,
      relevance: score * (0.8 + 0.2 * quality),
      genres: new Set<number>(item.genre_ids ?? []),
      fkey: franchiseKey(item.title ?? item.name ?? ""),
    };
  });

  // Franchise dedup — keep the strongest entry per franchise root.
  const bestByFranchise = new Map<string, Candidate>();
  for (const c of candidates) {
    const k = c.fkey || `id:${c.item.id}`;
    const cur = bestByFranchise.get(k);
    if (!cur || c.relevance > cur.relevance) bestByFranchise.set(k, c);
  }
  const pool = [...bestByFranchise.values()];

  // MMR selection — greedily pick the candidate that maximises
  //   relevance − λ · (max genre-similarity to already-picked).
  // The first pick is pure top relevance; each subsequent pick that looks like
  // what's already in the list gets discounted, so variety emerges naturally.
  const maxRel = Math.max(...pool.map((c) => c.relevance), 1e-9);
  const selected: Candidate[] = [];
  const remaining = new Set(pool);
  while (selected.length < STORE_COUNT && remaining.size > 0) {
    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (const c of remaining) {
      let sim = 0;
      for (const s of selected) {
        const j = jaccard(c.genres, s.genres);
        if (j > sim) sim = j;
      }
      const mmr = c.relevance / maxRel - MMR_LAMBDA * sim;
      if (mmr > bestScore) { bestScore = mmr; best = c; }
    }
    if (!best) break;
    selected.push(best);
    remaining.delete(best);
  }

  const ranked = selected.map(({ item }) => ({
    id: item.id,
    title: item.title ?? item.name ?? "",
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    vote_average: item.vote_average ?? 0,
    year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
    overview: item.overview ?? "",
    genre_ids: item.genre_ids ?? [],
    is_new: hadPrev && !prevIds.has(item.id),
  }));

  const { error } = await supabase.schema("watching").from("for_you_cache").upsert({
    user_id: userId,
    type,
    items: ranked,
    computed_at: new Date().toISOString(),
  });
  if (error) throw error;
  return true;
}

Deno.serve(async () => {
  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  if (!tmdbKey) return new Response("TMDB_API_KEY missing", { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("HEGON_SECRET_KEY")!,
  );

  // Users with at least one favorite (single-user today, but kept generic).
  const { data: favUsers } = await supabase.schema("watching").from("media_items")
    .select("user_id").eq("favorite", true);
  const userIds = [...new Set((favUsers ?? []).map((u: any) => u.user_id))] as string[];

  const types: MediaType[] = ["film", "serie", "anime"];
  let refreshed = 0;
  for (const userId of userIds) {
    for (const type of types) {
      try {
        if (await refreshUserType(supabase, tmdbKey, userId, type)) refreshed++;
      } catch (e) {
        console.error("for-you refresh failed", userId, type, String(e));
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, users: userIds.length, refreshed }),
    { headers: { "Content-Type": "application/json" } },
  );
});
