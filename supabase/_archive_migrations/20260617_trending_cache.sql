-- GLOBAL "Don't Miss" / trending cache — shared reference content (NOT per-user).
-- One row per media type, holding the raw TMDB list objects { trending, recommendations }.
-- Refreshed daily by the `trending-refresh` edge function + cron. The client just
-- READS this → instant, zero TMDB latency at request time. Items are the raw TMDB
-- objects, so "Add to collection" (which re-fetches full details by id) is unaffected.

create table if not exists watching.trending_cache (
  type         text primary key check (type in ('film','serie','anime')),
  items        jsonb       not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

alter table watching.trending_cache enable row level security;

-- Global public reference (TMDB data): any user reads the same rows. Writes happen
-- only via the edge function (service role → bypasses RLS). No org_id, no user_id:
-- this never duplicates per tenant, unlike the personalized for_you_cache.
drop policy if exists "trending_read" on watching.trending_cache;
create policy "trending_read" on watching.trending_cache
  for select using (true);

grant select on watching.trending_cache to anon, authenticated;
