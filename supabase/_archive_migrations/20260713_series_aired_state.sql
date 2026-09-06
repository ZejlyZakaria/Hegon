-- THE MISSING CONCEPT: aired ≠ announced.
--
-- `season_episodes` comes from TMDB and lists what is ANNOUNCED. House of the Dragon carries
-- [10, 8, 8] while only THREE episodes of season 3 have actually aired. The app has always
-- decided everything from that column — which is why it let you rate an episode that doesn't
-- exist, and why "watched" was the only word it could offer for a show that isn't over.
--
--   season_episodes → what exists on paper
--   season_aired    → what you could actually have watched   ([10, 8, 3])
--
-- Every rule now reads `season_aired`. State becomes a FUNCTION of two numbers (what you've
-- seen, what has aired) instead of a boolean somebody has to remember to flip. Nobody ever
-- does: 25 rows in this database say `watched` on a show TMDB still calls `ongoing`.

alter table watching.media_items
  add column if not exists season_aired int[],
  -- When you last reached the end of what had aired. Non-null = you were caught up once, so
  -- when the sync finds new episodes we know to light the card up with "New episodes" rather
  -- than treating it as ordinary lateness.
  add column if not exists caught_up_at timestamptz,
  -- Nothing refreshed TMDB, ever. `status` and `season_episodes` were snapshots taken the day
  -- you added the title, so The Boys stays "ongoing" for eternity and Bleach exists twice with
  -- 53 and 41 episodes. This column is how the sync job knows what it still owes.
  add column if not exists last_synced_at timestamptz;

comment on column watching.media_items.season_aired is
  'Episodes ACTUALLY AIRED per season. The only source of truth for progress, +1, episode locking and completion. season_episodes is announced-only and must never drive a decision.';
comment on column watching.media_items.caught_up_at is
  'When you last saw everything that had aired. Non-null = you were caught up; used to surface "New episodes" when the world moves on.';
comment on column watching.media_items.last_synced_at is
  'Last TMDB refresh of status / season_episodes / season_aired. Null = never synced.';

-- The sync job asks for exactly one thing: series that are not over, oldest refresh first.
create index if not exists media_items_sync_idx
  on watching.media_items (last_synced_at nulls first)
  where type <> 'film' and (status is null or status not in ('ended', 'canceled', 'cancelled'));
