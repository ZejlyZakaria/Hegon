// =====================================================
// WATCHING — how long is one sitting? (pure, testable)
// =====================================================
//
// ⚠️ `episode_run_time` IS EFFECTIVELY DEAD ON TMDB. Measured 2026-07-25 against the live API: it
// comes back `[]` for 10 series out of 10 — House of the Dragon, The Boys, Severance, The Last of
// Us, Silo, Breaking Bad, Game of Thrones, Dark, Squid Game, Arcane. And it is NOT a series-versus-
// anime distinction, which is the tempting wrong model: Attack on Titan, Demon Slayer and Blue Lock
// return `[]` too, while One Piece, Jujutsu Kaisen and Frieren still carry a value. The field simply
// survives on older, well-tended entries. It is data completeness, not semantics.
//
// So the fallback is not a nicety, it is the main road: `last_episode_to_air.runtime` rides along in
// the very same `/tv/{id}` response we already fetch, which makes it free.
//
// ── WHY THIS IS ITS OWN FILE ──────────────────────────────────────────────────────────────────
// Because it was written TWICE and the two copies drifted. The add modal grew the fallback; the
// mapper behind the discover page never did, and stopped one rung short — so every title added
// through discover was born with `runtime = null`, which is 0 hours in Stats, permanently (no cron
// and no script ever repairs `runtime`). Elite: 0.0 h through discover, 60.8 h through the modal,
// same title, same day.
//
// A value derived from an external API belongs to ONE function, for the same reason a status does
// (`watch-status.ts`). And it lives in `lib/`, importing nothing from the module, because the last
// constant shared between two components by exporting it from one of them created an import cycle
// that only broke in a production bundle.

/** Only the fields the cascade reads. Both call sites (TMDB details, modal payload) satisfy it. */
export interface TmdbRuntimeSource {
  /** FILM — total minutes. */
  runtime?: number | null;
  /** SERIES — the announced per-episode length. Usually `[]`; see the note above. */
  episode_run_time?: number[] | null;
  /** SERIES — the newest episode that exists, and it carries its own runtime. */
  last_episode_to_air?: { runtime?: number | null } | null;
  /**
   * ANY number of seasons, riding along on the same request via `append_to_response=season/1` (and
   * `season/2`, `season/3`… when the caller can afford to name them). Every episode carries its own
   * runtime, and pooling them is the only sample big enough to take a MEDIAN of.
   *
   * The live add path appends ONE season, because it does not know how many exist until the
   * response arrives and will not pay a second round trip. A repair script has no such constraint
   * and can hand over the whole show. Same function, same rule, a bigger sample — which is the only
   * kind of divergence worth having between an app and its scripts.
   */
  [season: `season/${number}`]: { episodes?: { runtime?: number | null }[] } | null | undefined;
}

/** Every episode runtime TMDB attached to this payload, whichever seasons were requested. */
function pooledEpisodeRuntimes(d: TmdbRuntimeSource): number[] {
  const out: number[] = [];
  for (const [key, value] of Object.entries(d)) {
    if (!/^season\/\d+$/.test(key)) continue;
    const eps = (value as { episodes?: { runtime?: number | null }[] } | null)?.episodes ?? [];
    for (const e of eps) if ((e?.runtime ?? 0) > 0) out.push(e.runtime as number);
  }
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length / 2;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Minutes for ONE sitting: the whole film, or one episode.
 *
 * `null` means "we genuinely do not know" — never 0. Zero is a claim (a title worth no time at all)
 * and it would be indistinguishable from a real answer downstream; a few titles have neither source
 * (Blue Lock has an empty `episode_run_time` AND no aired episode yet) and they must stay unknown.
 */
export function runtimeFromTmdb(d: TmdbRuntimeSource | null | undefined, isFilm: boolean): number | null {
  if (!d) return null;
  if (isFilm) return d.runtime ?? null;

  /**
   * MEASURED EPISODES FIRST — a median over real ones beats any single number.
   *
   * `last_episode_to_air.runtime` was the fallback for a day, and it is ONE SAMPLE taken at the
   * worst possible moment: the newest episode is very often a double-length finale. Measured
   * against the live API — Demon Slayer answered 41 where its episodes run 24, Severance 76 where
   * they run 49, Elite 57 where they run 47. Elite alone: 64 episodes × 10 minutes of error, ten
   * hours invented on the stats page. The panel is what made it visible.
   *
   * Three samples minimum, because a median of one or two is just a sample with a longer name. The
   * season rides on the request we were already making (`append_to_response`), so this is free.
   */
  const measured = pooledEpisodeRuntimes(d);
  if (measured.length >= 3) return median(measured);

  // Averaged, not `[0]`: an anthology can list several lengths, and the first one is not more true
  // than the others. On the usual single-entry array this is the identity.
  const announced = Array.isArray(d.episode_run_time) ? d.episode_run_time.filter((n) => n > 0) : [];
  if (announced.length > 0) {
    return Math.round(announced.reduce((a, b) => a + b, 0) / announced.length);
  }

  // Last resort, and knowingly rough: better a finale's length than no length at all, which is zero
  // hours forever.
  return d.last_episode_to_air?.runtime ?? null;
}
