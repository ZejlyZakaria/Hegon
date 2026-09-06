-- Anime v2 — the AniList season overlay.
--
-- THE PROBLEM: TMDB lumps a whole anime franchise into ONE flat season. Jujutsu Kaisen is "Season 1,
-- 59 episodes" on TMDB, when it is really three seasons (24 + 23 + 12). Blue Lock is "38 episodes",
-- really two seasons (24 + 14). You want to see the real seasons, each with its own poster.
--
-- AniList knows the real breakdown. This table stores it, resolved per franchise and keyed by the
-- TMDB id we already track. It is PURELY ADDITIVE: media_items is untouched, and the app falls back to
-- TMDB's flat structure whenever a title has no row here (most series, and anime AniList doesn't map).
--
-- SHARED REFERENCE, not per-user: the AniList breakdown of Jujutsu Kaisen is the same for everyone, so
-- it is stored ONCE (like watching.trending_cache), not once per owner. No org_id. A service-role job
-- writes it; every user reads it.
--
-- `cours` shape (jsonb array, ordered by air date = the real season order):
--   [{ season, anilist_id, title, poster_url, year, episodes, start_episode, end_episode }]
--   · season         1-based, chronological (our derived S1/S2/S3 label)
--   · start/end_episode  the TMDB flat-episode range this season covers (25..47 = Jujutsu S2)
--   · episodes        AniList episode count for the season (null while a season is still airing)

create table if not exists watching.anime_cours (
  tmdb_id      integer     primary key,
  cours        jsonb       not null default '[]'::jsonb,
  -- 'anilist' = resolved from AniList; 'none' = no mapping found (cached so we don't retry forever).
  source       text        not null default 'anilist',
  resolved_at  timestamptz not null default now()
);

alter table watching.anime_cours enable row level security;

-- Public anime metadata, identical for every user → global read, exactly like trending_cache.
create policy "anime_cours_read" on watching.anime_cours for select using (true);
grant select on watching.anime_cours to anon, authenticated;
-- Writes happen ONLY through the service role (the resolver job), which bypasses RLS. There is
-- deliberately no insert/update policy for end users: they can't tamper with the world's facts.
