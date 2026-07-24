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
  /** SERIES — the newest episode that exists, and it carries its own runtime. The real source. */
  last_episode_to_air?: { runtime?: number | null } | null;
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

  // Averaged, not `[0]`: an anthology can list several lengths, and the first one is not more true
  // than the others. On the usual single-entry array this is the identity.
  const announced = Array.isArray(d.episode_run_time) ? d.episode_run_time.filter((n) => n > 0) : [];
  if (announced.length > 0) {
    return Math.round(announced.reduce((a, b) => a + b, 0) / announced.length);
  }

  return d.last_episode_to_air?.runtime ?? null;
}
